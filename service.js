import express from "express";
import sql from "mysql";
import path from "path";
import {fileURLToPath}  from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var app = express();
const port = 3001;

const pool = sql.createConnection({
    //connectionLimit: 10,
    host: 'localhost', // You were missing the host
    user: "root",
    password: "admin@123",
    database: "airport"
});

app.get("/", (request, response) => {
    response.sendFile(path.join(__dirname, "/index.html"));
});



app.get("/search", (request, response) => {
    let query = request.query.q;
    //query = query.trim().replace(/\s+/g+'');
    if (query) {
       
        const sql = "SELECT * FROM airport_with_rank WHERE airport_code LIKE ? OR airport_name LIKE ? OR city_name LIKE ?OR state_name LIKE ?OR country_name LIKE ?";
        const likeQuery = `%${query}%`;
        console.time("test-timer");
        pool.query(sql, [likeQuery,likeQuery, likeQuery, likeQuery, likeQuery], (err, results) => {
            if (err) {
                console.error(err);
                response.status(500).send("An error occurred");
                return;
            }
            response.json(results);
        });
        console.timeEnd("test-timer");
    } else {
        const sql = "SELECT * FROM airport_with_rank ORDER BY airport_id";
        pool.query(sql, (err, results) => {
            if (err) {
                console.error(err);
                response.status(500).send("An error occurred");
                return;
            }
            response.json(results);
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


// import express from "express";

// import sql from "mysql";

// import path from "path";

// import { fileURLToPath } from "url";

// const __filename= fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);



// var app = express();

// const port = 3001;

// const pool = sql.createPool({
//     connectionLimit :10 ,
//     user:"root",
//     password:"admin@123",
//     database:"mydb"
// });

// app.get("/",(request,response)=>{
//    response.sendFile(__dirname+"/index.html");
// });

// app.get("/search",(request,response)=>{
//     const query = request.query.q;
//     var sql ='';
//     if(sql != ""){
//         sql = `SELECT * FROM LiveDataSearch WHERE airlines LIKE ' %${query}%' OR SELECT * FROM LiveDataSearch WHERE cityname LIKE ' %${query}%'
//         OR SELECT * FROM LiveDataSearch WHERE statename LIKE ' %${query}%' OR SELECT * FROM LiveDataSearch WHERE countryname LIKE ' %${query}%' `
//     }
//     else{
//         sql ="SELECT * FROM TABLENAME ORDERBY ID";
//     }

//     pool.query(sql,(err,result)=>{
//         if(err) throw console.error();

//         response.send(result)
// ;
//     })
// });

// app.listen(port,()=>{
//     console.log(`server running on port ${port}`);
// });