use std::sync::Mutex;

use lazy_static::lazy_static;

use rusqlite::{Connection, Error, Result};
use serde::Serialize;

lazy_static! {
    static ref CONN: Mutex<Connection> =
        Mutex::new(Connection::open(format!("{}/.config/mongoui/saved.db", env!("HOME"))).unwrap());
}

#[derive(Debug, Serialize)]
pub struct SavedDb {
    id: i32,
    name: String,
    uri: String,
}

pub fn ensure_tables() -> Result<(), ()> {
    let con = CONN.lock().unwrap();
    con.execute(
        "CREATE TABLE IF NOT EXISTS saved_dbs (
            id    INTEGER PRIMARY KEY,
            name  TEXT NOT NULL UNIQUE,
            uri  TEXT NOT NULL
        )",
        (),
    )
    .unwrap();
    Ok(())
}

pub fn create_saved_db(name: String, uri: String) -> Result<(), ()> {
    let con = CONN.lock().unwrap();
    con.execute(
        "INSERT INTO saved_dbs (name, uri) VALUES (?1, ?2)",
        (name, uri),
    )
    .unwrap();
    Ok(())
}

pub fn get_dbs() -> Result<Vec<SavedDb>, Error> {
    let con = CONN.lock().unwrap();
    let mut stmt = con.prepare("SELECT id, name, uri FROM saved_dbs")?;
    let rows = stmt.query_map((), |row| {
        Ok(SavedDb {
            id: row.get(0).unwrap(),
            name: row.get(1).unwrap(),
            uri: row.get(2).unwrap(),
        })
    })?;

    Ok(rows.map(|row| row.unwrap()).collect())
}
