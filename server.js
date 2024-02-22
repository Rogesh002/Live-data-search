import express from "express";
import sql from "mysql";
import path from "path";
import {fileURLToPath}  from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var app = express();
const port = 8081;

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

app.get("/search", async (request, response) => {
    let query = request.query.q;
    query = query.replace(/\s+/g, "").toLowerCase();
    const likeQuery = `%${query}%`;

    try {
        //console.time("search-timer");

       let exactMatchSql = `SELECT * FROM airport_with_rank WHERE REPLACE(LOWER(airport_code), ' ', '') = LOWER(?) LIMIT 1`;
        const exactMatchResults = await queryAsync(exactMatchSql, [query]);

        if (exactMatchResults.length > 0) {
            // If an exact match is found, fetch all airports in the same city
            const city = exactMatchResults[0].city_name; // Assuming city_name is the column name
            let cityAirportsSql = `SELECT * FROM airport_with_rank WHERE city_name = ?`;
            const cityAirports = await queryAsync(cityAirportsSql, [city]);
            response.json(cityAirports); 
        }
        else{
        let results = await new Promise((resolve, reject) => {
            pool.query(`
                SELECT airport_code, airport_name, city_name, state_name, country_name, 
                CASE
                    WHEN airport_code LIKE ? THEN 1
                    WHEN airport_name LIKE ? THEN 2
                    WHEN city_name LIKE ? THEN 3
                    WHEN state_name LIKE ? THEN 4
                    WHEN country_name LIKE ? THEN 5
                    ELSE 6
                END AS priority
                FROM airport_with_rank
                    WHERE LOWER(REPLACE(airport_code, ' ', '')) LIKE ? OR
                          LOWER(REPLACE(airport_name, ' ', '')) LIKE ? OR
                          LOWER(REPLACE(city_name, ' ', '')) LIKE ? OR
                          LOWER(REPLACE(state_name, ' ', '')) LIKE ? OR
                          LOWER(REPLACE(country_name, ' ', '')) LIKE ?
                          ORDER BY priority, airport_id
            `, [likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    

        //logic to load values based on 
        if(results.length<3 && results.length>0){
            let additionalResults =   await performSearch({state_name:results[0].state_name});
            additionalResults = additionalResults.filter(r => r.city_name !== results[0].city_name && r.airport_name !== results[0].airport_name);
            results = [...results, ...additionalResults];
        }

        if(results.length<5 && results.length>0){
            let additionalResults = await performSearch({country_name:results[0].country_name});
            additionalResults = additionalResults.filter(r => r.state_name !== results[0].state_name && r.airport_name !== results[0].airport_name);
            results = [...results, ...additionalResults];
        }
        
        response.json(results);
    }
    
    } catch (error) {
        console.error(error);
        response.status(500).send("An error occurred");
    }
    //  finally {
    //     console.timeEnd("search-timer");
    // }
});

function queryAsync(sql, params) {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

  function performSearch(condition) {
    return new Promise((resolve, reject) => {
        let column = Object.keys(condition)[0];
        let value = condition[column];
        let sqlQuery = `SELECT * FROM airport_with_rank WHERE ${column} LIKE ?`;

        pool.query(sqlQuery, [`%${value}%`], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
