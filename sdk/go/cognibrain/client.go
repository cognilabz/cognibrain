package cognibrain

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func New(baseURL string) Client {
	if baseURL == "" {
		baseURL = "http://127.0.0.1:8787"
	}
	return Client{BaseURL: strings.TrimRight(baseURL, "/"), HTTP: http.DefaultClient}
}

func (c Client) Add(memory map[string]any, out any) error {
	return c.request("POST", "/memories", memory, out)
}

func (c Client) Search(payload map[string]any, out any) error {
	return c.request("POST", "/search", payload, out)
}

func (c Client) Feedback(memoryID, kind, userID string, out any) error {
	return c.request("POST", "/feedback", map[string]any{"memoryId": memoryID, "kind": kind, "userId": userID}, out)
}

func (c Client) GraphQuery(query, userID string, out any) error {
	return c.request("POST", "/graph/query", map[string]any{"query": query, "userId": userID}, out)
}

func (c Client) request(method, path string, body any, out any) error {
	var payload bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&payload).Encode(body); err != nil {
			return err
		}
	}
	req, err := http.NewRequest(method, c.BaseURL+path, &payload)
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("cognibrain: %s", resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
