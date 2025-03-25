// support-ticket-processor.js
// This Node.js script can be deployed on Railway to process support tickets

const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@notionhq/client');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize clients
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Additional AI clients can be initialized here as needed
// Example: const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Notion database IDs
const TICKETS_DATABASE_ID = process.env.NOTION_TICKETS_DATABASE_ID;
const KNOWN_ISSUES_DATABASE_ID = process.env.NOTION_KNOWN_ISSUES_DATABASE_ID;
const LESSONS_DATABASE_ID = process.env.NOTION_LESSONS_DATABASE_ID;

app.use(bodyParser.json());

// Endpoint that receives webhook from Make when a new support conversation is completed
app.post('/process-ticket', async (req, res) => {
  try {
    const { conversationText, customerName, customerEmail, chatUrl } = req.body;
    
    if (!conversationText) {
      return res.status(400).json({ error: 'Conversation text is required' });
    }
    
    // Extract structured information using Claude
    const ticketInfo = await extractTicketInfo(conversationText);
    
    // Create Notion database entry
    const notionResponse = await createNotionEntry({
      customerName: customerName || ticketInfo.customerName,
      customerEmail: customerEmail || ticketInfo.customerEmail,
      chatUrl,
      ...ticketInfo
    });
    
    // Check if this is a known issue and link it
    if (ticketInfo.knownIssueIndication) {
      await linkToKnownIssue(notionResponse.id, ticketInfo.knownIssueIndication);
    }
    
    // Check if there are lessons learned to document
    if (ticketInfo.lessonsLearned && ticketInfo.lessonsLearned.length > 0) {
      await createLessonsLearned(notionResponse.id, ticketInfo.lessonsLearned);
    }
    
    res.json({
      success: true,
      ticketInfo,
      notionEntryId: notionResponse.id
    });
  } catch (error) {
    console.error('Error processing ticket:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configurable AI provider selection
const AI_PROVIDER = process.env.AI_PROVIDER || 'claude'; // Options: 'claude', 'openai', etc.

// Function to extract ticket information using selected AI provider
async function extractTicketInfo(conversationText) {
  // Common prompt for all AI providers
  const promptContent = `
Please analyze this support conversation and extract the following information in JSON format:

"""
${conversationText}
"""

Please extract:
1. issueTitle (a brief title for the ticket)
2. issueSummary (1-2 sentence description)
3. category (Technical, Billing, Account, Feature Request, or Other)
4. priority (Low, Medium, or High)
5. rootCause (User Error, Bug, Configuration, Third-party Issue, Documentation, or Training)
6. resolutionSummary (how the issue was resolved)
7. timeSpent (estimated minutes)
8. isRecurring (true or false)
9. requiresFollowUp (true or false)
10. followUpDate (YYYY-MM-DD format, only if followUp is true)
11. tags (array of relevant keywords)
12. knownIssueIndication (name of the known issue if it appears to be one)
13. lessonsLearned (array of insights worth documenting)
14. customerName (if mentioned in conversation)
15. customerEmail (if mentioned in conversation)

Respond only with valid JSON, with no additional text.`;

  switch (AI_PROVIDER.toLowerCase()) {
    case 'claude':
      return await extractWithClaude(promptContent);
    case 'openai':
      return await extractWithOpenAI(promptContent);
    // Add more providers as needed
    default:
      return await extractWithClaude(promptContent); // Default to Claude
  }
}

// Claude-specific implementation
async function extractWithClaude(promptContent) {
  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219",
    max_tokens: 1500,
    messages: [
      { role: "user", content: promptContent }
    ]
  });
  
  try {
    // Extract the JSON from Claude's response
    const content = response.content[0].text;
    // Find the JSON in Claude's response (it might not be perfectly formatted)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not parse JSON from Claude's response");
    }
  } catch (error) {
    console.error('Error parsing Claude response:', error, response.content[0].text);
    throw new Error('Failed to parse structured data from the conversation');
  }
}

// OpenAI implementation
async function extractWithOpenAI(promptContent) {
  // This function would need to be implemented when switching to OpenAI
  // You would need to install the OpenAI SDK: npm install openai
  
  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant that extracts structured information from support conversations." },
        { role: "user", content: promptContent }
      ],
      temperature: 0.3,
    });
    
    // Extract and parse the JSON from the response
    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not parse JSON from OpenAI's response");
    }
  } catch (error) {
    console.error('Error with OpenAI extraction:', error);
    throw new Error('Failed to parse structured data from the conversation');
  }
}

// You can add more AI provider implementations as needed
// async function extractWithCohere(promptContent) { ... }
// async function extractWithMistral(promptContent) { ... }
// etc.

// Function to create a Notion database entry
async function createNotionEntry(ticketData) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const response = await notion.pages.create({
      parent: { database_id: TICKETS_DATABASE_ID },
      properties: {
        "Issue Summary": {
          title: [{ text: { content: ticketData.issueSummary } }]
        },
        "Customer Name": {
          rich_text: [{ text: { content: ticketData.customerName || "Unknown" } }]
        },
        "Customer Email": {
          email: ticketData.customerEmail || ""
        },
        "Category": {
          select: { name: ticketData.category }
        },
        "Priority": {
          select: { name: ticketData.priority }
        },
        "Status": {
          select: { name: "Resolved" }
        },
        "Resolution Summary": {
          rich_text: [{ text: { content: ticketData.resolutionSummary } }]
        },
        "Created Date": {
          date: { start: today }
        },
        "Resolution Date": {
          date: { start: today }
        },
        "Time Spent": {
          number: parseInt(ticketData.timeSpent) || 0
        },
        "Recurring Issue": {
          checkbox: ticketData.isRecurring
        },
        "Follow-up Needed": {
          checkbox: ticketData.requiresFollowUp
        },
        "Root Cause": {
          select: { name: ticketData.rootCause }
        },
        "Tags": {
          multi_select: ticketData.tags.map(tag => ({ name: tag }))
        },
        "Chat History URLs": {
          url: ticketData.chatUrl || ""
        }
      }
    });
    
    return response;
  } catch (error) {
    console.error('Error creating Notion entry:', error);
    throw new Error('Failed to create Notion database entry');
  }
}

// Function to link ticket to known issue
async function linkToKnownIssue(ticketId, knownIssueName) {
  try {
    // First, search for the known issue by name
    const response = await notion.databases.query({
      database_id: KNOWN_ISSUES_DATABASE_ID,
      filter: {
        property: "Issue Name",
        rich_text: {
          contains: knownIssueName
        }
      }
    });
    
    let knownIssueId;
    
    // If the known issue exists, link to it
    if (response.results.length > 0) {
      knownIssueId = response.results[0].id;
    } else {
      // Create a new known issue
      const newKnownIssue = await notion.pages.create({
        parent: { database_id: KNOWN_ISSUES_DATABASE_ID },
        properties: {
          "Issue Name": {
            title: [{ text: { content: knownIssueName } }]
          },
          "Status": {
            select: { name: "Active" }
          }
        }
      });
      knownIssueId = newKnownIssue.id;
    }
    
    // Update the ticket to link to the known issue
    await notion.pages.update({
      page_id: ticketId,
      properties: {
        "Known Issue": {
          relation: [{ id: knownIssueId }]
        }
      }
    });
    
    return knownIssueId;
  } catch (error) {
    console.error('Error linking to known issue:', error);
    // Don't throw - this is a non-critical operation
    return null;
  }
}

// Function to create lessons learned
async function createLessonsLearned(ticketId, lessonsArray) {
  try {
    const results = [];
    
    for (const lessonText of lessonsArray) {
      // Create a new lesson learned entry
      const newLesson = await notion.pages.create({
        parent: { database_id: LESSONS_DATABASE_ID },
        properties: {
          "Title": {
            title: [{ text: { content: lessonText.slice(0, 100) } }]
          },
          "Description": {
            rich_text: [{ text: { content: lessonText } }]
          },
          "Category": {
            select: { name: "Technical" } // Default category, can be improved with classification
          },
          "Related Tickets": {
            relation: [{ id: ticketId }]
          }
        }
      });
      
      results.push(newLesson.id);
    }
    
    return results;
  } catch (error) {
    console.error('Error creating lessons learned:', error);
    // Don't throw - this is a non-critical operation
    return [];
  }
}

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});