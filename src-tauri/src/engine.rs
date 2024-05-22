use boa_engine::{
    builtins::{date::Date, object::OrdinaryObject, typed_array::TypedArray},
    class::{Class, ClassBuilder},
    error::JsNativeError,
    js_string,
    native_function::NativeFunction,
    object::{
        builtins::{JsArray, JsArrayBuffer, JsDate, JsUint8Array},
        ObjectInitializer,
    },
    Context, JsData, JsObject, JsResult, JsString, JsValue,
};

pub mod bson;

use mongodb::bson::{doc, Bson};

use boa_gc::{Finalize, Trace};
use mongodb::bson::Document;

use crate::{engine::bson::JsObjectId, CLIENTS};

#[derive(Debug, JsData, Trace, Finalize)]
pub struct Db {
    name: String,
    client_id: String,
}

impl Class for Db {
    const NAME: &'static str = "Db";
    const LENGTH: usize = 1;

    fn data_constructor(
        _this: &JsValue,
        args: &[JsValue],
        context: &mut Context,
    ) -> JsResult<Self> {
        let name = args
            .first()
            .ok_or(JsNativeError::error().with_message("db name is missing"))?
            .to_string(context)?
            .to_std_string()
            .map_err(|err| JsNativeError::typ().with_message(err.to_string()))?;

        let client_id = args
            .get(1)
            .ok_or(JsNativeError::error().with_message("client id is missing"))?
            .to_string(context)?
            .to_std_string()
            .map_err(|err| JsNativeError::typ().with_message(err.to_string()))?;

        Ok(Self { name, client_id })
    }

    /// Here is where the class is initialized.
    fn init(class: &mut ClassBuilder<'_>) -> JsResult<()> {
        class.method(
            js_string!("getCollection"),
            1,
            NativeFunction::from_fn_ptr(|this, args, ctx| {
                let this = this.clone();
                if let JsValue::Object(this) = this {
                    if let Ok(db) = this.downcast::<Db>() {
                        if let Some(name) = args.first() {
                            let name = name.to_string(ctx)?.to_std_string().map_err(|err| {
                                JsNativeError::typ().with_message(err.to_string())
                            })?;
                            let col = Collection { name, db };
                            let instance = Collection::from_data(col, ctx)?;
                            return Ok(instance.into());
                        }
                    }
                }
                return Err(JsNativeError::typ()
                    .with_message("invalid arguments to getCollection")
                    .into());
            }),
        );

        Ok(())
    }
}
#[derive(Debug, JsData, Trace, Finalize)]
pub struct Collection {
    name: String,
    db: JsObject<Db>,
}

fn bson_to_js(bson_doc: Bson, context: &mut Context) -> JsValue {
    println!("doc_to_js: {:?}", bson_doc);
    let js_value: JsValue = match bson_doc {
        Bson::String(s) => JsString::from(s).into(),
        Bson::Int32(i) => JsValue::from(i),
        Bson::Int64(i) => JsValue::from(i),
        Bson::Double(d) => JsValue::from(d),
        Bson::Array(a) => {
            let js_array = JsArray::new(context);
            for value in a.into_iter() {
                let value = bson_to_js(value, context);
                js_array.push(value, context).unwrap();
            }
            js_array.into()
        }
        Bson::Document(d) => {
            let js_object = ObjectInitializer::new(context).build();
            for (key, value) in d.into_iter() {
                let value = bson_to_js(value, context);
                js_object
                    .set(js_string!(key), value, true, context)
                    .unwrap();
            }
            js_object.into()
        }
        Bson::Boolean(v) => JsValue::from(v),
        Bson::Null => JsValue::Null,
        Bson::RegularExpression(r) => js_string!(r.to_string()).into(),
        Bson::JavaScriptCode(_) => todo!(),
        Bson::JavaScriptCodeWithScope(_) => todo!(),
        Bson::Timestamp(t) => {
            let js_date = JsDate::new(context);
            js_date.set_seconds(&[t.time.into()], context).unwrap();
            js_date.into()
        }
        Bson::Binary(binary) => {
            let js_array_buffer = JsArrayBuffer::from_byte_block(binary.bytes, context).unwrap();
            let uint8_typed_array =
                JsUint8Array::from_array_buffer(js_array_buffer, context).unwrap();
            uint8_typed_array.into()
        }
        Bson::ObjectId(o) => JsObjectId::from_data(JsObjectId::new(Some(o)), context)
            .unwrap()
            .into(),
        Bson::DateTime(d) => {
            let js_date = JsDate::new(context);
            js_date.set_time(d.timestamp_millis(), context).unwrap();
            js_date.into()
        }
        Bson::Symbol(s) => js_string!(s.to_string()).into(),
        Bson::Decimal128(d) => js_string!(d.to_string()).into(),
        Bson::Undefined => JsValue::Undefined,

        Bson::MaxKey => JsValue::Null,
        Bson::MinKey => JsValue::Null,
        Bson::DbPointer(_) => JsValue::Null,
    };

    js_value
}

pub fn js_to_bson(js_value: JsValue, context: &mut Context) -> JsResult<Bson> {
    let bson = match js_value {
        JsValue::Null => Bson::Null,
        JsValue::Undefined => Bson::Undefined,
        JsValue::String(s) => Bson::String(
            s.to_std_string()
                .map_err(|err| JsNativeError::typ().with_message(err.to_string()))?,
        ),
        JsValue::Integer(n) => Bson::Int32(n),
        JsValue::Boolean(b) => Bson::Boolean(b),
        JsValue::Rational(d) => Bson::Double(d),
        JsValue::BigInt(v) => Bson::Int64(v.to_f64() as i64),
        JsValue::Object(obj) => {
            if obj.is_array() {
                let arr = JsArray::from_object(obj)?;
                let arr_length = arr.length(context)?;

                let mut bson_arr = Vec::new();
                for i in 0..arr_length {
                    let value = arr.get(i, context)?;
                    let value_bson = js_to_bson(value, context)?;
                    bson_arr.push(value_bson);
                }
                return Ok(Bson::Array(bson_arr).into());
            } else {
                if obj.is::<Date>() {
                    let obj = JsDate::from_object(obj).unwrap();
                    let dt = mongodb::bson::DateTime::from_millis(
                        obj.get_time(context)?.to_number(context)? as i64,
                    );
                    return Ok(Bson::DateTime(dt));
                };

                if obj.is::<TypedArray>() {
                    todo!()
                    // let obj = JsUint8Array::from_object(obj).unwrap();
                    // return Ok(Bson::Binary(mongodb::bson::Binary {
                    //     subtype: mongodb::bson::spec::BinarySubtype::Generic,
                    //     bytes,
                    // }));
                }

                if let Some(obj) = obj.downcast_ref::<JsObjectId>() {
                    let inner = obj.into_inner();
                    return Ok(Bson::ObjectId(inner));
                }

                let entries = OrdinaryObject::entries(&JsValue::Null, &[obj.into()], context)?
                    .to_object(context)?;
                let mut document = Document::new();
                let entries = JsArray::from_object(entries)?;
                let length = entries.length(context)?;
                for i in 0..length {
                    let key_value = entries.get(i, context)?;
                    if let JsValue::Object(key_value) = key_value {
                        let key_value = JsArray::from_object(key_value)?;
                        let key = key_value
                            .get(0, context)?
                            .to_string(context)?
                            .to_std_string_escaped();
                        let value = js_to_bson(key_value.get(1, context)?, context)?;
                        document.insert(key, value);
                    }
                }
                return Ok(document.into());
            }
        }
        JsValue::Symbol(s) => {
            let s = s.to_string();
            Bson::Symbol(s)
        }
    };
    return Ok(bson);
}

impl Collection {
    fn find(this: &JsValue, args: &[JsValue], context: &mut Context) -> JsResult<JsValue> {
        let args = args
            .get(0)
            .ok_or(JsNativeError::error().with_message("find requires an argument"))?;

        let args = js_to_bson(args.clone(), context)?;

        let args = match args {
            Bson::Document(doc) => doc,
            _ => return Err(JsNativeError::error().with_message("invalid args").into()),
        };

        let collection = this
            .as_object()
            .and_then(|v| v.downcast_ref::<Collection>())
            .ok_or(JsNativeError::error().with_message("invalid this"))?;

        let db_borrow = collection.db.borrow();
        let db = db_borrow.data();

        let clients = CLIENTS.read().unwrap();
        let entry = clients
            .iter()
            .find(|client| client.id == db.client_id)
            .ok_or(JsNativeError::error().with_message("client not intialized"))?;

        let mut cursor = entry
            .client
            .database(&db.name)
            .collection::<Document>(collection.name.as_str())
            .find(args, None)
            .map_err(|err| JsNativeError::error().with_message(err.to_string()))?;

        let mut data = Vec::new();
        while let Some(el) = cursor.next() {
            let el = el.map_err(|err| JsNativeError::error().with_message(err.to_string()))?;
            data.push(el);
        }
        let bson_data = Bson::from(data);
        let js_value = bson_to_js(bson_data.into(), context);
        return Ok(js_value);
    }

    fn find_one(this: &JsValue, args: &[JsValue], context: &mut Context) -> JsResult<JsValue> {
        let args = args
            .get(0)
            .ok_or(JsNativeError::error().with_message("find requires an argument"))?;

        let args = js_to_bson(args.clone(), context)?;

        let args = match args {
            Bson::Document(doc) => doc,
            _ => return Err(JsNativeError::error().with_message("invalid args").into()),
        };

        let collection = this
            .as_object()
            .and_then(|v| v.downcast_ref::<Collection>())
            .ok_or(JsNativeError::error().with_message("invalid this"))?;

        let db_borrow = collection.db.borrow();
        let db = db_borrow.data();

        let clients = CLIENTS.read().unwrap();
        let entry = clients
            .iter()
            .find(|client| client.id == db.client_id)
            .ok_or(JsNativeError::error().with_message("client not intialized"))?;

        let res = entry
            .client
            .database(&db.name)
            .collection::<Document>(collection.name.as_str())
            .find_one(args, None)
            .map_err(|err| JsNativeError::error().with_message(err.to_string()))?;

        if res.is_none() {
            return Ok(JsValue::null());
        }
        let data = res.unwrap();
        let js_value = bson_to_js(data.into(), context);
        return Ok(js_value);
    }

    fn insert_one(this: &JsValue, args: &[JsValue], context: &mut Context) -> JsResult<JsValue> {
        let args = args
            .get(0)
            .ok_or(JsNativeError::error().with_message("insert_one requires an argument"))?;

        // TODO: probably just need to convert to document instead of trying to convert to bson
        let args = js_to_bson(args.clone(), context)?;
        let args = args
            .as_document()
            .ok_or(JsNativeError::error().with_message("invalid argument"))?;

        let collection = this
            .as_object()
            .and_then(|obj| obj.downcast_ref::<Collection>())
            .ok_or(JsNativeError::error().with_message("invalid argument"))?;

        let db_borrow = collection.db.borrow();
        let db = db_borrow.data();

        let clients = CLIENTS.read().unwrap();
        let entry = clients
            .iter()
            .find(|client| client.id == db.client_id)
            .ok_or(JsNativeError::error().with_message("client not intialized"))?;

        let res = entry
            .client
            .database(&db.name)
            .collection::<Document>(collection.name.as_str())
            .insert_one(args, None)
            .map_err(|err| JsNativeError::error().with_message(err.to_string()))?;

        let inserted = doc! {
            "acknowledged" : true,
            "insertedId" : res.inserted_id
        };

        let js_value = bson_to_js(inserted.into(), context);
        return Ok(js_value);
    }

    fn insert_many(this: &JsValue, args: &[JsValue], context: &mut Context) -> JsResult<JsValue> {
        let args = args
            .get(0)
            .ok_or(JsNativeError::error().with_message("insert_one requires an argument"))?;

        // TODO: probably just need to convert to document instead of trying to convert to bson
        let args = js_to_bson(args.clone(), context)?;

        let args = args
            .as_array()
            .ok_or(JsNativeError::error().with_message("invalid argument"))?
            .into_iter()
            .map(|v| {
                v.as_document()
                    .ok_or(JsNativeError::error().with_message("invalid argument"))
            })
            .collect::<Result<Vec<_>, JsNativeError>>()?;

        let collection = this
            .as_object()
            .and_then(|obj| obj.downcast_ref::<Collection>())
            .ok_or(JsNativeError::error().with_message("invalid argument"))?;

        let db_borrow = collection.db.borrow();
        let db = db_borrow.data();

        let clients = CLIENTS.read().unwrap();
        let entry = clients
            .iter()
            .find(|client| client.id == db.client_id)
            .ok_or(JsNativeError::error().with_message("client not intialized"))?;

        let res = entry
            .client
            .database(&db.name)
            .collection::<Document>(collection.name.as_str())
            .insert_many(args, None)
            .map_err(|err| JsNativeError::error().with_message(err.to_string()))?;

        let inserted_ids = res
            .inserted_ids
            .into_iter()
            .map(|(_, id)| id)
            .collect::<Vec<_>>();

        let inserted = doc! {
            "acknowledged" : true,
            "insertedIds" : inserted_ids
        };

        let js_value = bson_to_js(inserted.into(), context);
        return Ok(js_value);
    }
}

impl Class for Collection {
    const NAME: &'static str = "Collection";
    const LENGTH: usize = 1;

    fn data_constructor(
        _this: &JsValue,
        args: &[JsValue],
        context: &mut Context,
    ) -> JsResult<Self> {
        let name = args
            .get(0)
            .ok_or(JsNativeError::error().with_message("name is missing"))?
            .to_string(context)?
            .to_std_string()
            .map_err(|err| JsNativeError::typ().with_message(err.to_string()))?;

        let db = args
            .get(1)
            .ok_or(JsNativeError::error().with_message("db is missing"))?
            .clone();

        if let JsValue::Object(db) = db {
            if let Ok(db) = db.downcast::<Db>() {
                return Ok(Self { name, db });
            }
        }
        return Err(JsNativeError::typ().with_message("invalid argument").into());
    }

    fn init(class: &mut ClassBuilder<'_>) -> JsResult<()> {
        class.method(
            js_string!("find"),
            1,
            NativeFunction::from_fn_ptr(Self::find),
        );

        class.method(
            js_string!("findOne"),
            1,
            NativeFunction::from_fn_ptr(Self::find_one),
        );

        class.method(
            js_string!("insertOne"),
            1,
            NativeFunction::from_fn_ptr(Self::insert_one),
        );

        class.method(
            js_string!("insertMany"),
            1,
            NativeFunction::from_fn_ptr(Self::insert_many),
        );

        return Ok(());
    }
}
