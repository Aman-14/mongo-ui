// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use boa_engine::{self, JsError};
use lazy_static::lazy_static;
use mongodb::bson::doc;
use mongodb::{self};
use serde_json::Value;
use std::sync::RwLock;

use engine::{bson::JsObjectId, js_to_bson, Collection, Db};
mod db;
mod engine;

lazy_static! {
    static ref CLIENTS: RwLock<Vec<SyncClientEntry>> = RwLock::new(Vec::new());
}

#[derive(thiserror::Error, Debug)]
enum Error {
    #[error("Invalid Argument: {}", .0)]
    InvalidArgument(String),

    #[error("Something Went Wrong")]
    SomethingWentWrong,

    #[error("{0}")]
    JsExecution(#[from] JsError),

    #[error("Mongo Error: {0}")]
    Mongo(#[from] mongodb::error::Error),

    #[error("Sqlite Error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_str())
    }
}

#[tauri::command]
async fn greet(name: String) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

struct SyncClientEntry {
    client: mongodb::sync::Client,
    id: String,
}
impl SyncClientEntry {
    fn new(uri: String) -> Result<Self, Error> {
        let client = mongodb::sync::Client::with_uri_str(uri)?;
        Ok(Self {
            id: uuid::Uuid::new_v4().to_string(),
            client,
        })
    }
}

#[derive(serde::Serialize)]
struct ConnectDbResponse {
    id: String,
    dbs: Vec<String>,
}

#[tauri::command]
async fn connect_db(uri: String, name: Option<String>) -> Result<ConnectDbResponse, Error> {
    let entry = SyncClientEntry::new(uri.clone())?;
    let id = entry.id.clone();
    let dbs = entry.client.list_database_names(None, None)?;

    if let Some(name) = name {
        if !name.is_empty() {
            db::create_saved_db(name, uri)?
        }
    }

    CLIENTS.write().unwrap().push(entry);
    Ok(ConnectDbResponse { id, dbs })
}

#[tauri::command]
async fn get_collection_names(client_id: String, db_name: String) -> Result<Vec<String>, Error> {
    let entry_borrow = CLIENTS.read().map_err(|_| Error::SomethingWentWrong)?;
    let entry = entry_borrow
        .iter()
        .find(|c| c.id == client_id)
        .ok_or(Error::InvalidArgument("client not found".to_string()))?;

    let collections_names = entry
        .client
        .database(db_name.as_str())
        .list_collection_names(None)?;

    Ok(collections_names)
}

#[tauri::command]
async fn exec_script(client_id: String, db_name: String, script: String) -> Result<Value, Error> {
    let client_borrow = CLIENTS.read().map_err(|_| Error::SomethingWentWrong)?;
    let client = client_borrow
        .iter()
        .find(|c| c.id == client_id)
        .ok_or(Error::InvalidArgument("client not found".to_string()))?;

    let mut context = boa_engine::Context::default();
    context.register_global_class::<Db>()?;
    context.register_global_class::<Collection>()?;
    context.register_global_class::<JsObjectId>()?;

    let db_initiation = format!("const db = new Db('{}', '{}');", db_name, client.id);
    context.eval(boa_engine::Source::from_bytes(db_initiation.as_str()))?;

    let js_value = context.eval(boa_engine::Source::from_bytes(script.as_str()))?;
    let bson = js_to_bson(js_value, &mut context)?;
    Ok(bson.into())
}

#[tauri::command]
async fn get_saved_dbs() -> Result<Vec<db::SavedDb>, String> {
    let dbs = db::get_dbs();
    let res: Result<Vec<db::SavedDb>, String> = match dbs {
        Ok(dbs) => Ok(dbs),
        Err(err) => {
            println!("{}", err);
            Err(err.to_string())
        }
    };
    res
}

#[tauri::command]
async fn connect_saved_db(id: i32) -> Result<ConnectDbResponse, Error> {
    let res = db::get_db(id)?;
    let entry = SyncClientEntry::new(res.uri)?;
    let id = entry.id.clone();
    let dbs = entry.client.list_database_names(None, None)?;
    CLIENTS.write().unwrap().push(entry);
    Ok(ConnectDbResponse { id, dbs })
}

fn main() {
    db::ensure_tables();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            connect_db,
            greet,
            exec_script,
            get_collection_names,
            get_saved_dbs,
            connect_saved_db
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
