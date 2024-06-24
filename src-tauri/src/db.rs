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
    pub id: i32,
    pub name: String,
    pub uri: String,
    pub created_at: i64,
}

pub fn ensure_tables() {
    let con = CONN.lock().unwrap();
    con.execute(
        "CREATE TABLE IF NOT EXISTS saved_dbs (
            id         INTEGER PRIMARY KEY,
            name       TEXT NOT NULL UNIQUE,
            uri        TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        (),
    )
    .unwrap();
}

pub fn create_saved_db(name: String, uri: String) -> Result<(), Error> {
    let con = CONN.lock().unwrap();
    con.execute(
        "INSERT INTO saved_dbs (name, uri, created_at) VALUES (?1, ?2, strftime('%s','now'))",
        (name, uri),
    )?;
    Ok(())
}

pub fn get_dbs() -> Result<Vec<SavedDb>, Error> {
    let con = CONN.lock().unwrap();
    let mut stmt = con.prepare("SELECT id, name, uri, created_at FROM saved_dbs")?;
    let rows = stmt.query_map((), |row| {
        Ok(SavedDb {
            id: row.get(0)?,
            name: row.get(1)?,
            uri: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;

    Ok(rows.map(|row| row.unwrap()).collect())
}

pub fn get_db(id: i32) -> Result<SavedDb, Error> {
    let con = CONN.lock().unwrap();
    let mut stmt = con.prepare("SELECT id, name, uri, created_at FROM saved_dbs where id = ?1")?;
    let row = stmt.query_row((id,), |row| {
        Ok(SavedDb {
            id: row.get(0)?,
            name: row.get(1)?,
            uri: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    Ok(row)
}
