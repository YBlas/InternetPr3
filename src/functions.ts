import { Collection, MongoClient, Db } from "mongodb";

//--------------------------> Conexión a mongoDB

export const connectMongo = async (): Promise<Db> => {
    const url = "mongodb+srv://Picard:engage@mongomake.3ta2r.mongodb.net/MongoMake?retryWrites=true&w=majority";
    const client = new MongoClient(url);
    const conexion = client.connect();
    conexion.then((elem)=>{
        console.log(`Conectado a Mongodb\n\r`)
    })
    const cole = await client.db("Vicio");
    return cole;
}

//--------------------------> Comprobar fechas

export const checkDate = (day:number, month:number, year:number):boolean => {
    if (day > 31 || day < 1 || month < 1 || month > 12 || year < 1900 || year > 3000) {
        return true;
    }
    if(month == 2 || month == 4 || month == 6 || month == 9 || month == 11){
            if(day==31) return true;
    }
    return false;
}