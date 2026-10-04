use std::collections::HashMap;
use std::io::{self, BufRead, Write};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ohttp::hpke::{Aead, Kdf, Kem};
use ohttp::{ClientRequest, ClientResponse, KeyConfig, Server, SymmetricSuite};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const BACKEND: &str = "martinthomson/ohttp";
const BACKEND_VERSION: &str = "0.8.0";
const PROFILE: &str = "RFC9458_OBLIVIOUS_HTTP";

#[derive(Debug, Deserialize)]
struct Request {
    op: String,
    #[serde(default)]
    id: String,
    #[serde(default)]
    config_b64: String,
    #[serde(default)]
    payload_b64: String,
    #[serde(default)]
    probe_b64: String,
}

#[derive(Debug, Serialize)]
struct Response {
    ok: bool,
    op: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    id: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    error: String,
    pid: u32,
    backend: &'static str,
    backend_version: &'static str,
    profile: &'static str,
    #[serde(skip_serializing_if = "String::is_empty")]
    config_b64: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    payload_b64: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    response_b64: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    plaintext_b64: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    sha256: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    contains_probe: Option<bool>,
}

impl Response {
    fn base(op: &str, id: &str) -> Self {
        Self {
            ok: true,
            op: op.to_string(),
            id: id.to_string(),
            error: String::new(),
            pid: std::process::id(),
            backend: BACKEND,
            backend_version: BACKEND_VERSION,
            profile: PROFILE,
            config_b64: String::new(),
            payload_b64: String::new(),
            response_b64: String::new(),
            plaintext_b64: String::new(),
            sha256: String::new(),
            contains_probe: None,
        }
    }

    fn error(op: &str, id: &str, error: impl ToString) -> Self {
        let mut r = Self::base(op, id);
        r.ok = false;
        r.error = error.to_string();
        r
    }
}

fn main() {
    let mode = std::env::args().nth(1).unwrap_or_default();
    ohttp::init();
    let result = match mode.as_str() {
        "client" => run_client(),
        "relay" => run_relay(),
        "gateway" => run_gateway(),
        _ => Err("usage: scic_ohttp_runtime client|relay|gateway".into()),
    };
    if let Err(e) = result {
        eprintln!("{e}");
        std::process::exit(2);
    }
}

fn write_response(out: &mut impl Write, response: &Response) -> Result<(), Box<dyn std::error::Error>> {
    serde_json::to_writer(&mut *out, response)?;
    out.write_all(b"\n")?;
    out.flush()?;
    Ok(())
}

fn read_loop<F>(mut handler: F) -> Result<(), Box<dyn std::error::Error>>
where
    F: FnMut(Request) -> Response,
{
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    write_response(&mut stdout, &Response::base("ready", ""))?;
    for line in stdin.lock().lines() {
        let line = line?;
        let req: Request = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => {
                write_response(&mut stdout, &Response::error("error", "", "INVALID_JSON"))?;
                continue;
            }
        };
        let response = handler(req);
        write_response(&mut stdout, &response)?;
    }
    Ok(())
}

fn run_client() -> Result<(), Box<dyn std::error::Error>> {
    let mut config: Option<Vec<u8>> = None;
    let mut states: HashMap<String, ClientResponse> = HashMap::new();
    read_loop(|req| {
        let mut response = Response::base(&req.op, &req.id);
        match req.op.as_str() {
            "init" => match STANDARD.decode(&req.config_b64) {
                Ok(bytes) => {
                    if ClientRequest::from_encoded_config(&bytes).is_err() {
                        return Response::error(&req.op, &req.id, "INVALID_CONFIG");
                    }
                    config = Some(bytes);
                }
                Err(_) => return Response::error(&req.op, &req.id, "INVALID_CONFIG_BASE64"),
            },
            "encapsulate" => {
                if req.id.is_empty() {
                    return Response::error(&req.op, &req.id, "REQUEST_ID_REQUIRED");
                }
                if states.contains_key(&req.id) {
                    return Response::error(&req.op, &req.id, "REQUEST_ID_ALREADY_EXISTS");
                }
                let Some(cfg) = config.as_ref() else {
                    return Response::error(&req.op, &req.id, "CLIENT_NOT_INITIALIZED");
                };
                let plain = match STANDARD.decode(&req.payload_b64) {
                    Ok(v) => v,
                    Err(_) => return Response::error(&req.op, &req.id, "INVALID_PAYLOAD_BASE64"),
                };
                let client = match ClientRequest::from_encoded_config(cfg) {
                    Ok(v) => v,
                    Err(e) => return Response::error(&req.op, &req.id, format!("CLIENT_INIT:{e:?}")),
                };
                match client.encapsulate(&plain) {
                    Ok((enc, state)) => {
                        states.insert(req.id.clone(), state);
                        response.payload_b64 = STANDARD.encode(enc);
                    }
                    Err(e) => return Response::error(&req.op, &req.id, format!("ENCAPSULATE:{e:?}")),
                }
            }
            "decapsulate" => {
                let Some(state) = states.remove(&req.id) else {
                    return Response::error(&req.op, &req.id, "UNKNOWN_REQUEST_ID");
                };
                let enc = match STANDARD.decode(&req.payload_b64) {
                    Ok(v) => v,
                    Err(_) => return Response::error(&req.op, &req.id, "INVALID_RESPONSE_BASE64"),
                };
                match state.decapsulate(&enc) {
                    Ok(plain) => response.plaintext_b64 = STANDARD.encode(plain),
                    Err(e) => return Response::error(&req.op, &req.id, format!("DECAPSULATE:{e:?}")),
                }
            }
            "ping" => {}
            _ => return Response::error(&req.op, &req.id, "UNKNOWN_OPERATION"),
        }
        response
    })
}

fn run_relay() -> Result<(), Box<dyn std::error::Error>> {
    read_loop(|req| {
        if req.op != "forward" {
            return Response::error(&req.op, &req.id, "UNKNOWN_OPERATION");
        }
        let payload = match STANDARD.decode(&req.payload_b64) {
            Ok(v) => v,
            Err(_) => return Response::error(&req.op, &req.id, "INVALID_PAYLOAD_BASE64"),
        };
        let probe = STANDARD.decode(&req.probe_b64).unwrap_or_default();
        let contains = !probe.is_empty() && payload.windows(probe.len()).any(|w| w == probe);
        let mut h = Sha256::new();
        h.update(&payload);
        let digest = format!("{:x}", h.finalize());
        let mut response = Response::base(&req.op, &req.id);
        response.payload_b64 = STANDARD.encode(payload);
        response.sha256 = digest;
        response.contains_probe = Some(contains);
        response
    })
}

fn run_gateway() -> Result<(), Box<dyn std::error::Error>> {
    let config = KeyConfig::new(
        1,
        Kem::X25519Sha256,
        vec![SymmetricSuite::new(Kdf::HkdfSha256, Aead::Aes128Gcm)],
    )?;
    let server = Server::new(config)?;
    let encoded = server.config().encode()?;

    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    let mut ready = Response::base("ready", "");
    ready.config_b64 = STANDARD.encode(encoded);
    write_response(&mut stdout, &ready)?;

    for line in stdin.lock().lines() {
        let line = line?;
        let req: Request = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => {
                write_response(&mut stdout, &Response::error("error", "", "INVALID_JSON"))?;
                continue;
            }
        };
        let mut response = Response::base(&req.op, &req.id);
        if req.op != "decapsulate" {
            response = Response::error(&req.op, &req.id, "UNKNOWN_OPERATION");
            write_response(&mut stdout, &response)?;
            continue;
        }
        let enc = match STANDARD.decode(&req.payload_b64) {
            Ok(v) => v,
            Err(_) => {
                response = Response::error(&req.op, &req.id, "INVALID_PAYLOAD_BASE64");
                write_response(&mut stdout, &response)?;
                continue;
            }
        };
        match server.decapsulate(&enc) {
            Ok((plain, server_response)) => match server_response.encapsulate(b"SCIC_OHTTP_ACCEPTED") {
                Ok(enc_response) => {
                    response.plaintext_b64 = STANDARD.encode(plain);
                    response.response_b64 = STANDARD.encode(enc_response);
                }
                Err(e) => response = Response::error(&req.op, &req.id, format!("RESPONSE:{e:?}")),
            },
            Err(e) => response = Response::error(&req.op, &req.id, format!("DECAPSULATE:{e:?}")),
        }
        write_response(&mut stdout, &response)?;
    }
    Ok(())
}
