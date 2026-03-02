# Benchmarking DocShark

This document outlines the **Who**, **Why**, **What**, and **How** of benchmarking DocShark's scraping, indexing, and search capabilities. 

---

## 🤷‍♂️ Who to Benchmark Against
To prove DocShark's value, we should compare it against the current industry standards for documentation scraping and indexing:
- [Firecrawl](https://www.firecrawl.dev/) (Leading proprietary LLM scraper)
- [Crawl4AI](https://github.com/unclecode/crawl4ai) (Leading open-source LLM crawler)

We must also directly benchmark against our direct **design inspirations**:
- [Grounded Docs (arabold/docs-mcp-server)](https://github.com/arabold/docs-mcp-server) - The main architectural inspiration for DocShark. We need to prove our SQLite/FTS5 approach is faster than their LangChain embeddings.
- [Context7](https://context7.com/) - They index raw GitHub source repos, not rendered HTML doc sites. We need to measure the quality gap in context payload between raw source code and our rendered markdown pipeline.

## 🎯 Why Benchmark?
1. **To prove latency benefits**: DocShark uses a local SQLite + FTS5 database, meaning search results return in `<50ms` compared to cloud-based solutions taking `1000ms+`.
2. **To prove extraction cleanliness**: High-quality markdown extraction saves massive amounts of context tokens for the AI.
3. **To optimize our architecture**: Catching memory leaks or slow queries as the dataset grows over time.

## 📊 What to Measure (The 4 Core Metrics)

1. **Crawl Velocity**: How fast can we download and process a 1,000-page site? (*Pages per second*)
2. **Search Latency**: How fast does our API return relevant chunks? (*Response time in milliseconds*)
3. **Token Efficiency**: How clean is our resulting markdown? (*Total token count vs. competitors*)
4. **Relevance Quality**: Does the top result actually answer the human's question? (*Win-rate percentage vs. competitors*)

---

## 🛠️ How to Benchmark

There is no "one-click" platform to automatically benchmark an MCP server against Firecrawl. We will use a hybrid approach of load-testing scripts and LLM-as-a-judge scripts.

### 1. Performance Testing (Speed/Stress Test)
**Tool**: [Grafana k6](https://k6.io/)

**How**: We write a simple `k6` script that hammers the DocShark `/api/search` endpoint via HTTP with 1,000 queries per second.
k6 will output a detailed terminal dashboard showing:
- Requests per second (RPS)
- P90, P95, and P99 latency percentiles
- Error rates

*Alternative quick tool*: [Autocannon](https://github.com/mcollina/autocannon) (`npx autocannon -c 100 -d 10 http://localhost:6380/api/search?q=test`)

### 2. Quality Evaluation (Relevance Test)
**Tool**: [Ragas](https://docs.ragas.io/) or custom OpenAI script.

**How**: 
1. Compile a test-set of 50 common documentation questions (e.g. *"How do I validate a custom schema in Valibot?"*).
2. Query DocShark and query the Competitor (e.g. Firecrawl) with these questions.
3. Feed both resulting `context` payloads to an AI judge (like `.gpt-4o-mini`) and ask: *"Based on the user's question, which of these two contexts provides a better, cleaner, more accurate answer?"*
4. Calculate the win-rate.
