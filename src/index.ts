import express, { Request, Response, NextFunction, response } from 'express';
import { request } from 'http';
import { MongoClient, Collection, Db } from "mongodb";
import { connectMongo, checkDate } from "./functions";
import { reserva, MONGOreserva, Usuario } from "./types";
import { v4 as uuidv4 } from "uuid";
const bodyParser = require('body-parser');

//To access from terminal: curl http://localhost:6969/

//Inicio express
const app = express();

//Conexión a mongoDB
const cole = connectMongo();

//Contexto
app.set("db", cole);

//--------------------------> Acción antes de cada request

app.use(async (req, res, next) => {
    //Get day
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    app.set("dd", dd);
    app.set("mm", mm);
    app.set("yyyy", yyyy);
    next();
});
//Pasar body a json entendible
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//--------------------------> Status Ok

app.get('/status', async (request: Request, response: Response) => {
    const dd = request.app.get("dd");
    const mm = request.app.get("mm");
    const yyyy = request.app.get("yyyy");
    const hoy: string = dd + '/' + mm + '/' + yyyy;
    response.status(200).send(`Fecha actual: ${hoy}, todo okey`);
});

//--------------------------> Registrarse

app.post('/SignIn', async (request: Request, response: Response) => {
    const db = await request.app.get("db");
    const UsuarioDB: Usuario = await db.collection("coworkingUsers").findOne({ email: request.body.email }) as Usuario;
    //Existe usuario ---> Error
    if (UsuarioDB) {
        response.status(409).send(`Ya existe un usuario con mail ${UsuarioDB.email}`);
    }
    //No existe usuario ---> Ok, se registra en db
    else {
        const UsuarioIn: Usuario = {
            email: request.body.email,
            pass: request.body.pass
        }
        const registrar = db.collection("coworkingUsers").insertOne(UsuarioIn).then((elem: any) => {
            response.status(200).send(`Vamos a registrar en la base de datos un usuario con\remail: ${request.body.email}\rContraseña: ${request.body.pass}`);
        }).catch((error: any) => {
            response.status(500).send(`Ha surgido un problema al hacer el registro\nError:${error}`);
        });

    }

});

//--------------------------> Logearse

app.post('/LogIn', async (request: Request, response: Response) => {
    const db = await request.app.get("db");
    const UsuarioDB: Usuario = await db.collection("coworkingUsers").findOne({ email: request.body.email, pass: request.body.pass }) as Usuario;
    //Existe usuario ---> Logearse y crear Token
    if (UsuarioDB) {
        app.set("token", uuidv4());
        app.set("email", request.body.email);
        response.status(409).send(`Usuario logeado con éxito, con token ${app.get("token")}`);
    }
    //No existe usuario ---> Error, no puede logearse
    else {
        response.status(401).send("El email o contraseña son incorrectos\n");
    }

});

//--------------------------> Salir

app.post('/LogOut', async (request: Request, response: Response) => {
    const tokenTest: string = app.get("token");
    if (tokenTest) {
        app.set('token', undefined);
        response.status(200).send("Log Out completo");
    } else {
        response.status(500).send("No se ha logeado");
    }

});

//--------------------------> Mostrar asientos libres en un dia concreto

app.get('/freeSeats', async (request: Request, response: Response) => {
    //Check de registro
    const tokenTest: string = app.get("token");
    if (!tokenTest) {
        response.status(500).send("No se ha logeado");
    } else response.header("token", tokenTest);
    //Todo el lio de comprobación de las fechas.
    const db = await request.app.get("db");
    const ango = request.query.year;
    const mes = request.query.month;
    const dia = request.query.day;
    let libres: number[] = [];
    const angoN: number = +ango!;
    const mesN: number = +mes!;
    const diaN: number = +dia!;
    if (checkDate(diaN, mesN, angoN)) {
        response.status(500).send("Esa fecha no está bien mozo\n\r");
    }
    const dd: number = +request.app.get("dd");
    const mm: number = +request.app.get("mm");
    const yyyy: number = +request.app.get("yyyy");
    if (angoN < yyyy) {
        response.status(500).send("Eso se ha quedado en el pasado\n\r");
    } else if (angoN == yyyy) {
        if (mm > mesN) response.status(500).send("Eso se ha quedado en el pasado\n\r");
        else if (mm == mesN) {
            if (diaN < dd) response.status(500).send("Eso se ha quedado en el pasado\n\r");
        }
    }

    //La mandanga de verdad
    for (let i: number = 1; i <= 20; i++) {
        const ocupado: reserva = await db.collection("coworking").findOne({ year: ango, month: mes, day: dia, seat: i.toString() });
        if (ocupado) console.log(`Puesto ya cogido: ${ocupado.seat}`);
        else if (!ocupado) libres.push(i);
    }
    response.status(200).send(libres!);
});

//--------------------------> Reservar un sitio

app.post('/book', async (request: Request, response: Response) => {
    //Check de registro
    const tokenTest: string = app.get("token");
    if (!tokenTest) {
        response.status(500).send("No se ha logeado");
    } else response.header("token", tokenTest);
    //Todo el lio de comprobación de las fechas.
    const db = await request.app.get("db");
    const ango = request.query.year;
    const mes = request.query.month;
    const dia = request.query.day;
    const puesto = request.query.seat;
    const angoN: number = +ango!;
    const mesN: number = +mes!;
    const diaN: number = +dia!;
    const puestoN: number = +puesto!;
    if (puestoN < 1 || puestoN > 20) {
        response.status(500).send("Sitio inexistente\n\r");
    }
    if (checkDate(diaN, mesN, angoN)) {
        response.status(500).send("Esa fecha no está bien mozo\n\r");
    }
    const dd: number = +request.app.get("dd");
    const mm: number = +request.app.get("mm");
    const yyyy: number = +request.app.get("yyyy");
    if (angoN < yyyy) {
        response.status(500).send("Eso se ha quedado en el pasado\n\r");
    } else if (angoN == yyyy) {
        if (mm > mesN) response.status(500).send("Eso se ha quedado en el pasado\n\r");
        else if (mm == mesN) {
            if (diaN < dd) response.status(500).send("Eso se ha quedado en el pasado\n\r");
        }
    }

    //La mandanga de verdad
    const ocupado: reserva = await db.collection("coworking").findOne({ year: ango, month: mes, day: dia, seat: puesto });
    if (ocupado) {
        console.log(ocupado);
        response.status(404).send("Sitio ya ocupado");
    }
    else if (!ocupado) {
        const reservado: MONGOreserva = {
            email: app.get("email"),
            token: app.get("token"),
            day: dia as any,
            month: mes as any,
            year: ango as any,
            seat: puesto as any
        }

        db.collection("coworking").insertOne(reservado);

        response.status(200).send(reservado);
    }
});

//--------------------------> Eliminar una reserva

app.post('/free', async (request: Request, response: Response) => {
    //Check de registro
    const tokenTest: string = app.get("token");
    if (!tokenTest) {
        response.status(500).send("No se ha logeado");
    } else response.header("token", tokenTest);
    //Todo el lio de comprobación de las fechas.
    const db = await request.app.get("db");
    const correo: string = app.get("email");
    const ango = request.query.year;
    const mes = request.query.month;
    const dia = request.query.day;
    const angoN: number = +ango!;
    const mesN: number = +mes!;
    const diaN: number = +dia!;

    if (checkDate(diaN, mesN, angoN)) {
        response.status(500).send("Esa fecha no está bien mozo\n\r");
    }
    const dd: number = +request.app.get("dd");
    const mm: number = +request.app.get("mm");
    const yyyy: number = +request.app.get("yyyy");
    if (angoN < yyyy) {
        response.status(500).send("Eso se ha quedado en el pasado\n\r");
    } else if (angoN == yyyy) {
        if (mm > mesN) response.status(500).send("Eso se ha quedado en el pasado\n\r");
        else if (mm == mesN) {
            if (diaN < dd) response.status(500).send("Eso se ha quedado en el pasado\n\r");
        }
    }

    //La mandanga de verdad
    let Aliberar: reserva = await db.collection("coworking").findOne({ year: ango, month: mes, day: dia, token: tokenTest });
    if (!Aliberar) Aliberar = await db.collection("coworking").findOne({ year: ango, month: mes, day: dia, email: correo });

    if (Aliberar) {
        db.collection("coworking").deleteOne({ year: Aliberar.year, month: Aliberar.month, day: Aliberar.day, seat: Aliberar.seat }).then((elem: any) => {
            response.status(200).send(`Vamos a eliminar la reserva del sitio:${Aliberar.seat} en la fecha ${Aliberar.day}/${Aliberar.month}/${Aliberar.year}`);
        }).catch((error: any) => {
            response.status(500).send(`Ha surgido un problema al eliminar la reserva\nError:${error}`);
        })

    }
    else if (!Aliberar) {
        response.status(404).send("No se encuentra una reserva del usuario en esa fecha");
    }
});

//--------------------------> Lista de reservas de un usuario.

app.get('/MyBookings', async (request: Request, response: Response) => {
    //Check de registro
    const tokenTest: string = app.get("token");
    if (!tokenTest) {
        response.status(500).send("No se ha logeado");
    } else response.header("token", tokenTest);
    const db = await request.app.get("db");
    const correo: string = app.get("email");


    //La mandanga de verdad
    db.collection("coworking").find().toArray().then((elem: any) => {
        const filtrado: any[] = elem.filter((elem: any) => {
            if (elem.email == app.get("email")) {
                const angoN:number = +elem.year;
                const mesN:number = +elem.month;
                const diaN:number = +elem.day;
                const dd: number = +request.app.get("dd");
                const mm: number = +request.app.get("mm");
                const yyyy: number = +request.app.get("yyyy");
                if (angoN < yyyy) {
                    return false;
                } else if (angoN == yyyy) {
                    if (mm > mesN) return false;
                    else if (mm == mesN) {
                        if (diaN < dd) return false;
                    }
                }
                return true;
            }
            else return false;
        });
        if(filtrado.length == 0) response.status(404).send("No existen reservas futuras de este usuario.");
        else response.status(200).send(filtrado);
    })
});
const port = process.env.PORT || 6969;

app.listen(port, () => {
    console.log(`Express working on port ${port}\n\r`)
});