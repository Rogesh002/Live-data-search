import express from "express";
import sql from "mysql";
import path from "path";
import {fileURLToPath}  from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var app = express();
const port = 8080;

const pool = sql.createPool({
    connectionLimit: 100,
    host: 'localhost', // You were missing the host
    user: "root",
    password: "admin@123",
    database: "airport"
});

app.get("/", (request, response) => {
    response.sendFile(path.join(__dirname, "/index.html"));
});

app.get("/search", (request, response) =>{
    let query = request.query.q;
        let sql;
        const likeQuery = `%${query}%`;
        console.time("search-timer");
        sql = `
                        SELECT airport_code,airport_name,city_name,state_name,country_name, 
                        CASE
                        WHEN airport_code LIKE ? THEN 1
                        WHEN airport_name LIKE ? THEN 2
                        WHEN city_name LIKE ? THEN 3
                        WHEN state_name LIKE ? THEN 4
                        WHEN country_name LIKE ? THEN 5
                        ELSE 6
                        END AS priority
                        FROM airport_with_rank
                        WHERE airport_code LIKE ? OR
                        airport_name LIKE ? OR
                        city_name LIKE ? OR
                        state_name LIKE ? OR
                        country_name LIKE ?
                        ORDER BY priority, airport_id
                              `;
                        pool.query(sql, [likeQuery,likeQuery,likeQuery, likeQuery, likeQuery,likeQuery,likeQuery,likeQuery,likeQuery,likeQuery], (err, results) => {
            
            if (err) {
                console.error(err);
                response.status(500).send("An error occurred");
                return;
            }
            response.json(results);
         console.timeEnd("search-timer");
});
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
