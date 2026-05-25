"""Minimal CrewAI-style memory tool wrapper.

CrewAI can wrap `run` as a tool function. The file stays dependency-free so the
SDK package can be tested without installing CrewAI.
"""

from cognibrain_client import CognibrainClient


class CognibrainMemoryTool:
    name = "cognibrain_memory"
    description = "Fetch governed cognibrain context for the current agent task."

    def __init__(self, user_id="default", api_key=None):
        self.user_id = user_id
        self.client = CognibrainClient(api_key=api_key, actor_id="crewai-agent")

    def run(self, query):
        pack = self.client.evidence_pack({"userId": self.user_id, "query": query, "tokenBudget": 900})
        return pack.get("context", "")
