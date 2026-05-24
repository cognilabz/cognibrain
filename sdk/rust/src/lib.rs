pub struct CognibrainClient {
    pub base_url: String,
}

impl CognibrainClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        let mut base_url = base_url.into();
        if base_url.is_empty() {
            base_url = "http://127.0.0.1:8787".to_string();
        }
        Self { base_url: base_url.trim_end_matches('/').to_string() }
    }

    pub fn memories_url(&self) -> String {
        format!("{}/memories", self.base_url)
    }

    pub fn search_url(&self) -> String {
        format!("{}/search", self.base_url)
    }

    pub fn feedback_url(&self) -> String {
        format!("{}/feedback", self.base_url)
    }

    pub fn graph_query_url(&self) -> String {
        format!("{}/graph/query", self.base_url)
    }
}
