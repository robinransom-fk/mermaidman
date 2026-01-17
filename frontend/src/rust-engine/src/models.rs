use serde::{Serialize, Deserialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Node {
    pub id: String,
    pub label: Option<String>,
    pub x: Option<i32>,
    pub y: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Edge {
    pub source: String,
    pub target: String,
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ParseResult {
    pub clean_code: String,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

pub struct NodeDirective {
    pub id: String,
    pub uid: Option<String>,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub meta: Option<Value>,
}

pub struct EdgeDirective {
    pub eid: Option<String>,
    pub source: Option<String>,
    pub target: Option<String>,
    pub label: Option<String>,
    pub meta: Option<Value>,
}

pub struct Spatial { 
    pub id: String, 
    pub x: i32, 
    pub y: i32 
}
