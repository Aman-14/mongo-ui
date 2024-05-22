use mongodb::bson::oid::ObjectId;
use std::str::FromStr;

use boa_engine::{
    class::Class, js_string, object::builtins::JsDate, JsData, JsNativeError, JsString, JsValue,
    NativeFunction,
};
use boa_gc::{Finalize, Trace};

#[derive(Debug, JsData)]
pub struct JsObjectId(ObjectId);

impl Finalize for JsObjectId {
    fn finalize(&self) {}
}

unsafe impl Trace for JsObjectId {
    unsafe fn trace(&self, _tracer: &mut boa_gc::Tracer) {}

    unsafe fn trace_non_roots(&self) {}

    fn run_finalizer(&self) {
        self.finalize()
    }
}

impl JsObjectId {
    pub fn new(oid: Option<ObjectId>) -> Self {
        if let Some(oid) = oid {
            return Self(oid);
        }
        return Self(ObjectId::new());
    }

    pub fn to_std_string(&self) -> String {
        self.0.to_string()
    }

    fn to_string(
        this: &JsValue,
        _args: &[JsValue],
        _context: &mut boa_engine::Context,
    ) -> boa_engine::JsResult<JsValue> {
        println!("to string called");
        if let Some(object) = this.as_object() {
            if let Some(oid) = object.downcast_ref::<JsObjectId>() {
                let s = JsString::from_str(oid.0.to_string().as_str())
                    .map_err(|err| JsNativeError::error().with_message(err.to_string()))?;

                return Ok(s.into());
            }
        }

        Err(JsNativeError::error()
            .with_message("Failed to convert to string".to_string())
            .into())
    }

    fn timestamp(
        this: &JsValue,
        _args: &[JsValue],
        context: &mut boa_engine::Context,
    ) -> boa_engine::JsResult<JsValue> {
        if let Some(object) = this.as_object() {
            if let Some(oid) = object.downcast_ref::<JsObjectId>() {
                let timestamp = oid.0.timestamp();
                let js_date = JsDate::new(context);
                js_date.set_time(timestamp.timestamp_millis(), context)?;
                return Ok(js_date.into());
            }
        }

        Err(JsNativeError::error()
            .with_message("Failed to get timestamp".to_string())
            .into())
    }

    pub fn into_inner(&self) -> ObjectId {
        self.0
    }
}

impl Class for JsObjectId {
    const NAME: &'static str = "ObjectId";
    const LENGTH: usize = 1;

    fn init(class: &mut boa_engine::class::ClassBuilder<'_>) -> boa_engine::JsResult<()> {
        class.method(
            js_string!("toString"),
            0,
            NativeFunction::from_fn_ptr(Self::to_string),
        );
        class.method(
            js_string!("timestamp"),
            0,
            NativeFunction::from_fn_ptr(Self::timestamp),
        );
        class.method(
            js_string!("toJSON"),
            0,
            NativeFunction::from_fn_ptr(Self::to_string),
        );
        Ok(())
    }

    fn data_constructor(
        _new_target: &boa_engine::JsValue,
        args: &[boa_engine::JsValue],
        _context: &mut boa_engine::Context,
    ) -> boa_engine::JsResult<Self> {
        let undefined = &JsValue::Undefined;
        let arg = args.first().unwrap_or(undefined);

        let object_id = match arg {
            JsValue::Undefined => ObjectId::new(),
            JsValue::String(arg) => {
                let object_id = ObjectId::from_str(arg.to_std_string_escaped().as_str())
                    .map_err(|err| JsNativeError::error().with_message(err.to_string()))?;
                object_id
            }
            _ => Err(JsNativeError::typ()
                .with_message("Argument must be a string or undefined".to_string()))?,
        };

        Ok(Self(object_id))
    }
}
