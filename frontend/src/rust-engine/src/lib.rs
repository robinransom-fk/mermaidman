use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use nom::{
    bytes::complete::{tag, take_until},
    character::complete::{alphanumeric1, digit1, space0, space1, char},
    combinator::{opt, recognize},
    sequence::{delimited, pair},
    branch::alt,
    IResult,
};
use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;

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

#[wasm_bindgen]
pub fn parse_mermaidman(input: &str) -> JsValue {
    let _ = console_error_panic_hook::set_once();
    let (clean_code, nodes, edges) = parse_logic(input);
    let result = ParseResult { clean_code, nodes, edges };
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn update_mermaidman_node(input: &str, node_id: &str, x: i32, y: i32) -> String {
    // Escape node_id for regex
    let escaped_id = regex::escape(node_id);
    // Regex to find the specific node directive line
    let pattern = format!(r"(?m)^%%\s*@node:\s*{}\s*(\{{.*?\}})\s*$", escaped_id);
    let re = Regex::new(&pattern).unwrap();
    let json_replacement = format!("%% @node: {} {}", node_id, json_directive_body(x, y));

    if let Some(caps) = re.captures(input) {
        if let Some(body_match) = caps.get(1) {
            if let Ok(mut value) = serde_json::from_str::<Value>(body_match.as_str()) {
                if let Some(obj) = value.as_object_mut() {
                    obj.insert("x".to_string(), Value::from(x));
                    obj.insert("y".to_string(), Value::from(y));
                }
                if let Ok(updated) = serde_json::to_string(&value) {
                    let replacement = format!("%% @node: {} {}", node_id, updated);
                    return re.replace(input, replacement.as_str()).to_string();
                }
            }
        }

        let replacement = format!("%% @node: {} {{ x: {}, y: {} }}", node_id, x, y);
        return re.replace(input, replacement.as_str()).to_string();
    }

    let mut new_input = input.trim_end().to_string();
    if !new_input.is_empty() {
         new_input.push('\n');
    }
    new_input.push_str(&json_replacement);
    new_input.push('\n');
    new_input
}

fn json_directive_body(x: i32, y: i32) -> String {
    let value = serde_json::json!({ "x": x, "y": y });
    serde_json::to_string(&value).unwrap_or_else(|_| format!("{{\"x\":{},\"y\":{}}}", x, y))
}

// --- Logic Implementation ---

fn parse_logic(input: &str) -> (String, Vec<Node>, Vec<Edge>) {
    let mut nodes_map: HashMap<String, Node> = HashMap::new();
    let mut edges = Vec::new();
    let mut node_directives: HashMap<String, NodeDirective> = HashMap::new();
    let mut edge_directives_by_pair: HashMap<(String, String), EdgeDirective> = HashMap::new();
    
    // Process line by line to preserve structure in "clean_code"
    for line in input.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }

        // 1. Directives
        if trimmed.starts_with("%%") {
            if let Some(directive) = parse_node_directive_line(trimmed) {
                node_directives.insert(directive.id.clone(), directive);
            } else if let Some(directive) = parse_edge_directive_line(trimmed) {
                if let (Some(source), Some(target)) = (directive.source.clone(), directive.target.clone()) {
                    edge_directives_by_pair.insert((source, target), directive);
                }
            }
            continue;
        }

        // Ignore non-node directives and comments
        if trimmed.starts_with("graph ") || trimmed.starts_with("flowchart ") {
            continue;
        }

        // 2. Edges (A --> B)
        if let Ok((_, (src, src_label, tgt, tgt_label, label))) = parse_edge(trimmed) {
            edges.push(Edge { 
                source: src.to_string(), 
                target: tgt.to_string(), 
                label: label.map(|s| s.to_string()),
                eid: None,
                meta: None,
            });
            let src_node = nodes_map.entry(src.to_string()).or_insert_with(|| Node { id: src.to_string(), label: None, x: None, y: None, uid: None, meta: None });
            if let Some(l) = src_label { src_node.label = Some(l.to_string()); }

            let tgt_node = nodes_map.entry(tgt.to_string()).or_insert_with(|| Node { id: tgt.to_string(), label: None, x: None, y: None, uid: None, meta: None });
            if let Some(l) = tgt_label { tgt_node.label = Some(l.to_string()); }
            continue;
        }

        // 3. Explicit Nodes (A[Label])
        if let Ok((_, (id, label))) = parse_node_declaration(trimmed) {
            let n = nodes_map.entry(id.to_string()).or_insert_with(|| Node { id: id.to_string(), label: None, x: None, y: None, uid: None, meta: None });
            if let Some(l) = label { n.label = Some(l.to_string()); }
            continue;
        }
    }

    // Garbage Collection: Only attach spatial data to nodes that exist in topology
    let mut final_nodes = Vec::new();
    for (id, mut node) in nodes_map {
        if let Some(directive) = node_directives.get(&id) {
            if let Some(x) = directive.x { node.x = Some(x); }
            if let Some(y) = directive.y { node.y = Some(y); }
            node.uid = directive.uid.clone();
            node.meta = directive.meta.clone();
        }
        final_nodes.push(node);
    }

    for edge in edges.iter_mut() {
        if let Some(directive) = edge_directives_by_pair.get(&(edge.source.clone(), edge.target.clone())) {
            edge.eid = directive.eid.clone();
            edge.meta = directive.meta.clone();
            if edge.label.is_none() {
                edge.label = directive.label.clone();
            }
        }
    }

    (input.to_string(), final_nodes, edges)
}

// --- Robust Parsers ---

struct Spatial { id: String, x: i32, y: i32 }

struct NodeDirective {
    id: String,
    uid: Option<String>,
    x: Option<i32>,
    y: Option<i32>,
    meta: Option<Value>,
}

struct EdgeDirective {
    eid: Option<String>,
    source: Option<String>,
    target: Option<String>,
    label: Option<String>,
    meta: Option<Value>,
}

fn parse_spatial_directive(input: &str) -> IResult<&str, Spatial> {
    let (input, _) = tag("%%")(input)?;
    let (input, _) = space0(input)?;
    let (input, _) = tag("@node:")(input)?;
    let (input, _) = space1(input)?;
    let (input, id) = alphanumeric1(input)?;
    let (input, _) = space0(input)?;
    let (input, _) = tag("{")(input)?;
    let (input, _) = space0(input)?;
    let (input, _) = tag("x:")(input)?;
    let (input, _) = space0(input)?;
    let (input, x_str) = recognize(pair(opt(char('-')), digit1))(input)?;
    let (input, _) = space0(input)?;
    let (input, _) = tag(",")(input)?;
    let (input, _) = space0(input)?;
    let (input, _) = tag("y:")(input)?;
    let (input, _) = space0(input)?;
    let (input, y_str) = recognize(pair(opt(char('-')), digit1))(input)?;
    let (input, _) = space0(input)?;
    let (input, _) = tag("}")(input)?;
    
    Ok((input, Spatial {
        id: id.to_string(),
        x: x_str.parse().unwrap_or(0),
        y: y_str.parse().unwrap_or(0),
    }))
}

fn parse_node_directive_line(input: &str) -> Option<NodeDirective> {
    let re = Regex::new(r"^%%\s*@node:\s*([A-Za-z0-9_]+)\s*(\{.*\})\s*$").ok()?;
    let caps = re.captures(input)?;
    let id = caps.get(1)?.as_str().to_string();
    let body = caps.get(2)?.as_str();

    if let Ok(value) = serde_json::from_str::<Value>(body) {
        let uid = value.get("uid").and_then(|v| v.as_str()).map(|s| s.to_string());
        let x = value.get("x").and_then(json_number_to_i32);
        let y = value.get("y").and_then(json_number_to_i32);
        return Some(NodeDirective { id, uid, x, y, meta: Some(value) });
    }

    if let Ok((_, spatial)) = parse_spatial_directive(input) {
        return Some(NodeDirective { id: spatial.id, uid: None, x: Some(spatial.x), y: Some(spatial.y), meta: None });
    }

    None
}

fn parse_edge_directive_line(input: &str) -> Option<EdgeDirective> {
    let re = Regex::new(r"^%%\s*@edge:\s*([A-Za-z0-9_]+)\s*(\{.*\})\s*$").ok()?;
    let caps = re.captures(input)?;
    let eid = caps.get(1).map(|m| m.as_str().to_string());
    let body = caps.get(2)?.as_str();

    let value = serde_json::from_str::<Value>(body).ok()?;
    let source = value.get("source").and_then(|v| v.as_str()).map(|s| s.to_string());
    let target = value.get("target").and_then(|v| v.as_str()).map(|s| s.to_string());
    let label = value.get("label").and_then(|v| v.as_str()).map(|s| s.to_string());

    Some(EdgeDirective {
        eid,
        source,
        target,
        label,
        meta: Some(value),
    })
}

fn json_number_to_i32(value: &Value) -> Option<i32> {
    value.as_i64().map(|v| v as i32).or_else(|| value.as_f64().map(|v| v.round() as i32))
}

fn parse_edge(input: &str) -> IResult<&str, (&str, Option<&str>, &str, Option<&str>, Option<&str>)> {
    let (input, (src, src_label)) = parse_node_declaration(input)?;
    let (input, _) = space0(input)?;

    // Match arrow types: -->, ---, -.-, etc.
    let (input, _) = alt((tag("-->"), tag("---"), tag("-.-")))(input)?;
    let (input, _) = space0(input)?;

    // Optional label in arrow? e.g. -- label -->
    // This is complex in Mermaid, simplified here for prototype

    let (input, (tgt, tgt_label)) = parse_node_declaration(input)?;
    Ok((input, (src, src_label, tgt, tgt_label, None)))
}

fn parse_node_declaration(input: &str) -> IResult<&str, (&str, Option<&str>)> {
    let (input, id) = alphanumeric1(input)?;
    let (input, label) = opt(alt((
        delimited(tag("["), take_until("]"), tag("]")),
        delimited(tag("(("), take_until("))"), tag("))")),
        delimited(tag("("), take_until(")"), tag(")")),
        delimited(tag("{"), take_until("}"), tag("}")),
    )))(input)?;
    
    Ok((input, (id, label)))
}
