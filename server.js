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

async function performSearch(query) {
    let results = [];
    let countryResults;
    
    
    if(query.length==3){
          results = await findExactMatchByAirportCode(query);

         if (results.length > 0) {
            // Assuming parent_location_id is part of the result, and you want related airports
            const parentLocationId = results[0].parent_location_id;
            const relatedAirports = await findAirportsByParentLocationId(parentLocationId);
            // Combine and filter out any duplicates, assuming a helper function for this
            results = combineAndRemoveDuplicates(results, relatedAirports);
        }

        if (results.length < 20) {
            const additionalResultsByName = await findAirportsByName(query);
            results = combineAndRemoveDuplicates(results, additionalResultsByName);
            // Repeat for city_name and state_name as needed
        }

        return results;
    }
    else if(query.length>=4){
        let result = await findAirportsByName(query);
        
        if(result.length>0){
            const parentLocationId = result[0].parent_location_id;
            const relatedAirPorts =await findAirportsByParentLocationId(parentLocationId);
            result= combineAndRemoveDuplicates(result,relatedAirPorts)
        }

        return result ;
    }
    else{
        //let placeholders = country_code.map(() => '?').join(', '); 
        const sql = `
        SELECT airport_code, airport_name, city_name, state_name, country_name,
        CASE 
            WHEN country_code = 'IN' THEN 1
            WHEN country_code = 'US' THEN 2
            WHEN country_code = 'CA' THEN 3
            ELSE 4
        END as country_priority
        FROM airport_with_rank
        WHERE (
            airport_code LIKE CONCAT(?, '%') OR
            airport_name LIKE CONCAT(?, '%') OR
            parent_location_id LIKE CONCAT(?,'%') OR
            city_name LIKE CONCAT(?, '%') OR
            state_name LIKE CONCAT(?, '%')
        )  
        ORDER BY country_priority, 
          CASE 
              WHEN airport_code LIKE CONCAT(?, '%') THEN 1
              WHEN airport_name LIKE CONCAT(?, '%') THEN 2
              WHEN parent_location_id LIKE CONCAT(?,'%') THEN 3
              WHEN city_name LIKE CONCAT(?, '%') THEN 4
              WHEN state_name LIKE CONCAT(?, '%') THEN 5
          END, airport_id
        LIMIT 20;
        `;
        
        console.time("1");
        const queryParams = [query,query,query, query, query, query,query,query, query, query];
         countryResults = await queryAsync(sql, queryParams);
        console.timeEnd("1");
        results = results.concat(countryResults);
       // if (results.length >= 20){break} ;
    }
    return results;
}

    // If less than 20 results after all countries, search globally
    async function globalSerach(query,result) {
        const globalSql = `
            SELECT airport_code, airport_name, city_name, state_name, country_name
            FROM airport_with_rank
            WHERE (
                airport_code LIKE CONCAT(?, '%') OR
                airport_name LIKE CONCAT(?, '%') OR
                city_name LIKE CONCAT(?, '%') OR
                state_name LIKE CONCAT(?, '%')
            )
            ORDER BY 
                CASE 
                    WHEN airport_code LIKE CONCAT(?, '%') THEN 0
                    WHEN airport_name LIKE CONCAT(?, '%') THEN 1
                    WHEN city_name LIKE CONCAT(?, '%') THEN 2
                    WHEN state_name LIKE CONCAT(?, '%') THEN 3
                END, airport_id
            LIMIT 20;
        `;

        const globalResults = await queryAsync(globalSql, [query, query, query, query, query, query, query, query]);
        let ans  = result.concat(globalResults).slice(0, 20); // Ensure no more than 20 results
        if(query.length<3){
        ans= combineAndRemoveDuplicates(countryResults,ans);
        }else{
        ans =combineAndRemoveDuplicates(result,ans);
        }
        return ans;
    }
    


async function findExactMatchByAirportCode(airportCode) {
    return new Promise((resolve, reject) => {
        pool.query("SELECT * FROM airport_with_rank WHERE airport_code = ?", [airportCode], (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

async function findAirportsByParentLocationId(parentLocationId) {
    return new Promise((resolve, reject) => {
        pool.query("SELECT * FROM airport_with_rank WHERE parent_location_id = ?", [parentLocationId], (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

async function findAirportsByName(name) {
    return new Promise((resolve, reject) => {
        pool.query("SELECT * FROM airport_with_rank WHERE airport_name LIKE ? or city_name like ?", [`${name}%`,`${name}%`], (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

function combineAndRemoveDuplicates(primaryResults, additionalResults) {
    const combined = [...primaryResults, ...additionalResults];
    // Implement logic to remove duplicates based on your data structure, e.g., airport_id
    return combined.filter((airport, index, self) =>
        index === self.findIndex((t) => (
            t.airport_id === airport.airport_id
        ))
    );
}
// Utility function for database queries with async/await
function queryAsync(sql, params) {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}
// Example usage
app.get("/search", async (req, res) => {
    const query = req.query.q;
    //const country_code  = ["IN", "US", "CA"]; // Order matters

    try {
        let results = await performSearch(query);

        if(results.length<20){
            results= await globalSerach(query,results);
        }
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred");
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// app.get("/search", async (request, response) => {
//     let query = request.query.q;
//     query = query.replace(/\s+/g, "").toLowerCase();
//     const likeQuery = `${query}%`;

//     try {
//         //console.time("search-timer");

//        //let exactMatchSql = `SELECT * FROM airport_with_rank WHERE REPLACE(LOWER(airport_code), ' ', '') = LOWER(?) LIMIT 1`;
//        //const exactMatchResults = await queryAsync(exactMatchSql, [query]);

//         // if (exactMatchResults.length > 0) {
//         //     // If an exact match is found, fetch all airports in the same city
//         //     const city = exactMatchResults[0].city_name; // Assuming city_name is the column name
//         //     let cityAirportsSql = `SELECT * FROM airport_with_rank WHERE city_name = ?`;
//         //     const cityAirports = await queryAsync(cityAirportsSql, [city]);
//         //     response.json(cityAirports); 
//         // }
//         //else{
//         let results = await new Promise((resolve, reject) => {
//             if(query.length==1){
//             pool.query(`
//                 SELECT airport_code, airport_name, city_name, state_name, country_name, 
//                 CASE
//                     WHEN airport_code LIKE ? THEN 1
//                     WHEN airport_name LIKE ? THEN 2
//                     WHEN city_name LIKE ? THEN 3
//                     WHEN state_name LIKE ? THEN 4
//                     WHEN country_name LIKE ? THEN 5
//                     ELSE 6
//                 END AS priority
//                 FROM airport_with_rank
//                     WHERE LOWER(REPLACE(airport_code, ' ', '')) LIKE ? OR
//                           LOWER(REPLACE(airport_name, ' ', '')) LIKE ? OR
//                           LOWER(REPLACE(city_name, ' ', '')) LIKE ? OR
//                           LOWER(REPLACE(state_name, ' ', '')) LIKE ? OR
//                           LOWER(REPLACE(country_name, ' ', '')) LIKE ?
//                           ORDER BY priority, airport_id
//             `, [likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery], (err, results) => {
//                 if (err) reject(err);
//                 else resolve(results);
//             });
//         }
//         });
    
    

//         //logic to load values based on 
//         if(results.length<3 && results.length>0){
//             let additionalResults =   await performSearch({state_name:results[0].state_name});
//             additionalResults = additionalResults.filter(r => r.city_name !== results[0].city_name && r.airport_name !== results[0].airport_name);
//             results = [...results, ...additionalResults];
//         }

//         if(results.length<5 && results.length>0){
//             let additionalResults = await performSearch({country_name:results[0].country_name});
//             additionalResults = additionalResults.filter(r => r.state_name !== results[0].state_name && r.airport_name !== results[0].airport_name);
//             results = [...results, ...additionalResults];
//         }
        
//         response.json(results);
//     }
    
//    // } 
//     catch (error) {
//         console.error(error);
//         response.status(500).send("An error occurred");
//     }
//     //  finally {
//     //     console.timeEnd("search-timer");
//     // }
// });

// function queryAsync(sql, params) {
//     return new Promise((resolve, reject) => {
//         pool.query(sql, params, (err, results) => {
//             if (err) reject(err);
//             else resolve(results);
//         });
//     });
// }

//   function performSearch(condition) {
//     return new Promise((resolve, reject) => {
//         let column = Object.keys(condition)[0];
//         let value = condition[column];
//         let sqlQuery = `SELECT * FROM airport_with_rank WHERE ${column} LIKE ?`;

//         pool.query(sqlQuery, [`%${value}%`], (err, results) => {
//             if (err) {
//                 reject(err);
//             } else {
//                 resolve(results);
//             }
//         });
//     });
// }
