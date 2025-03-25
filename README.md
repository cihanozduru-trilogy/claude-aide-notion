# Support Ticket Processor

An AI-powered service that automatically processes support ticket conversations and maintains a structured Notion database.

## Features

- Analyzes support conversations using AI (Claude or OpenAI)
- Extracts structured data including issue details, priority, and resolution
- Creates and updates entries in Notion databases
- Links tickets to known issues and lessons learned
- Designed to integrate with Make.com for workflow automation

## Requirements

- Node.js 18+
- Anthropic API key (Claude)
- Optional: OpenAI API key
- Notion API key and database IDs
- Make.com account for workflow integration

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your API keys
3. Install dependencies: `npm install`
4. Start the server: `npm start`

## Environment Variables

| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 3000) |
| API_SECRET_KEY | Secret key for API authentication |
| AI_PROVIDER | AI provider to use (claude, openai) |
| ANTHROPIC_API_KEY | Anthropic API key for Claude |
| CLAUDE_MODEL | Claude model to use |
| OPENAI_API_KEY | OpenAI API key |
| OPENAI_MODEL | OpenAI model to use |
| NOTION_API_KEY | Notion API key |
| NOTION_TICKETS_DATABASE_ID | ID of tickets database |
| NOTION_KNOWN_ISSUES_DATABASE_ID | ID of known issues database |
| NOTION_LESSONS_DATABASE_ID | ID of lessons learned database |

## API Endpoints

### POST /process-ticket

Processes a support conversation and creates Notion database entries.

**Headers:**
- Content-Type: application/json
- Authorization: Bearer YOUR_API_SECRET_KEY

**Request Body:**
```json
{
  "conversationText": "Full text of the support conversation",
  "customerName": "Optional customer name",
  "customerEmail": "Optional customer email",
  "chatUrl": "URL to the original chat"
}