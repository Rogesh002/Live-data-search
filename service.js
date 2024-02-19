import express from "express";

import sql from "mysql";

var app = express();

const port = 3000;

const pool = sql.createPool({
    connectionLimit :10 ,
    user:"root",
    password:"admin@123",
    database:"mydb"
});

app.get("/",(request,response)=>{
   response.sendFile(__dirname+"/index.html");
});

app.get("/search",(request,response)=>{
    const query = request.query.q;
    var sql ='';
    if(sql != ""){
        sql = `SELECT * FROM TABLENAME WHERE NAME LIKE ' %${query}%' OR `
    }
    else{
        sql ="SELECT * FROM TABLENAME ORDERBY ID";
    }

    pool.query(sql,(err,result)=>{
        if(err) throw console.error();

        response.send(result)
;
    })
});

app.listen(port,()=>{
    console.log(`server running on port ${port}`);
});