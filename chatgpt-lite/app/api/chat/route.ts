import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser'
import { NextRequest, NextResponse } from 'next/server'
import { InvokeModelWithResponseStreamCommand,BedrockRuntimeClient,InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

import {contextRagRetrieve,getSystemPrompt} from "../bed-rock-service"


export const runtime = 'edge'

export interface Message {
  role: string
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, messages, input } = (await req.json()) as {
      prompt: string
      messages: Message[]
      input: string
    }
    let las3chatmessages:Message[]=[];
    if(messages)
    {
     las3chatmessages = messages.slice(3) 
    }
   
    const messagesWithHistory = [
      { content: prompt, role: 'system' },
      ...messages,
      { content: input, role: 'user' }
    ]

    const promptKB = await contextRagRetrieve(input);
    const messagesWith3ChatHistory = [
      { content: promptKB, role: 'user' }, 
    ]
    console.log("messagesWith3ChatHistory",messagesWith3ChatHistory);
    
    const iterator =  getBedRockAIStream("", "", promptKB, messagesWith3ChatHistory)
    const stream = iteratorToStream(iterator)
    //const { apiUrl, apiKey, model } = getApiConfig()
    //const stream = await getOpenAIStream(apiUrl, apiKey, model, messagesWithHistory)
    return new Response(stream)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function iteratorToStream(iterator:any)
{
  return new ReadableStream({
    async pull(controller) {
      const {value, done} = await iterator.next();
      if(done)
      {
        controller.close();
      }
      else
      {
        controller.enqueue(value);
      }
    },

  });
}

const getApiConfig = () => {
  const useAzureOpenAI =
    process.env.AZURE_OPENAI_API_BASE_URL && process.env.AZURE_OPENAI_API_BASE_URL.length > 0

  let apiUrl: string
  let apiKey: string
  let model: string
  if (useAzureOpenAI) {
    let apiBaseUrl = process.env.AZURE_OPENAI_API_BASE_URL
    const apiVersion = '2024-02-01'
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || ''
    if (apiBaseUrl && apiBaseUrl.endsWith('/')) {
      apiBaseUrl = apiBaseUrl.slice(0, -1)
    }
    apiUrl = `${apiBaseUrl}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
    apiKey = process.env.AZURE_OPENAI_API_KEY || ''
    model = '' // Azure Open AI always ignores the model and decides based on the deployment name passed through.
  } else {
    let apiBaseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com'
    if (apiBaseUrl && apiBaseUrl.endsWith('/')) {
      apiBaseUrl = apiBaseUrl.slice(0, -1)
    }
    apiUrl = `${apiBaseUrl}/v1/chat/completions`
    apiKey = process.env.OPENAI_API_KEY || ''
    model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
  }

  return { apiUrl, apiKey, model }
}

const getOpenAIStream = async (
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Message[]
) => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const res = await fetch(apiUrl, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'api-key': `${apiKey}`
    },
    method: 'POST',
    body: JSON.stringify({
      model: model,
      frequency_penalty: 0,
      max_tokens: 4000,
      messages: messages,
      presence_penalty: 0,
      stream: true,
      temperature: 0.5,
      top_p: 0.95
    })
  })

  if (res.status !== 200) {
    const statusText = res.statusText
    const responseBody = await res.text()
    console.error(`OpenAI API response error: ${responseBody}`)
    throw new Error(
      `The OpenAI API has encountered an error with a status code of ${res.status} ${statusText}: ${responseBody}`
    )
  }

  return new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data

          if (data === '[DONE]') {
            controller.close()
            return
          }

          try {
            const json = JSON.parse(data)
            const text = json.choices[0]?.delta?.content
            if (text !== undefined) {
              const queue = encoder.encode(text)
              controller.enqueue(queue)
            } else {
              console.error('Received undefined content:', json)
            }
          } catch (e) {
            console.error('Error parsing event data:', e)
            controller.error(e)
          }
        }
      }

      const parser = createParser(onParse)

      for await (const chunk of res.body as any) {
        // An extra newline is required to make AzureOpenAI work.
        const str = decoder.decode(chunk).replace('[DONE]\n', '[DONE]\n\n')
        parser.feed(str)
      }
    }
  })
}


async function*  getBedRockAIStream(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Message[]
) {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  
  let prompt_config = {
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 4096,
    "temperature":0,
    "system": getSystemPrompt(),
    "messages": messages,
  };

  let body = JSON.stringify(prompt_config);
  console.log("prompt",body)
  const accessKeyId = process.env.ACCESS_KEY_ID 
  const secretAccessKey = process.env.SECRRET_ACCESS_KEY
  const region =  process.env.REGION
  const bedrock = new BedrockRuntimeClient({ region: region ,
         credentials: {
           accessKeyId: accessKeyId!, // permission to invoke agent
           secretAccessKey: secretAccessKey!,
         },});


  const command = new InvokeModelWithResponseStreamCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: "application/json",
    body: body
  });
  /* const command1 = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: "application/json",
    body: body
  }); */
  //const response = await bedrock.send(command1);
  
  const res = await bedrock.send(command);

  /* if (res.status !== 200) {
    const statusText = res.statusText
    const responseBody = await res.text()
    console.error(`OpenAI API response error: ${responseBody}`)
    throw new Error(
      `The OpenAI API has encountered an error with a status code of ${res.status} ${statusText}: ${responseBody}`
    )
  }
 */
  

      for await (const item of res.body as any) {
        // An extra newline is required to make AzureOpenAI work.
        const chunk = JSON.parse(new TextDecoder().decode(item.chunk.bytes));
        // Get its type
        const chunk_type = chunk.type;
        
        
        // Process the chunk depending on its type
        if (chunk_type === "content_block_delta") {
          // The "content_block_delta" chunks contain the actual response text

          // Print each individual chunk in real-time
          
          //const queue = encoder.encode(chunk.delta.text)
          //console.log("chunk.delta.text",chunk.delta.text)
          
          yield chunk.delta.text;
          //const queue = encoder.encode(chunk.delta.text)
          //controller.enqueue(queue)  
          // ... and add it to the complete message
          

        } 
      }
   
}

const getBedRockAINewStream = async (
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Message[]
) => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let prompt_config = {
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 4096,
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": model },
        ],
      }
    ],
  };

  let body = JSON.stringify(prompt_config);
  console.log("prompt",body)
  let bedrock = new BedrockRuntimeClient({ region: "us-east-1" ,
    credentials: {
      accessKeyId: "", // permission to invoke agent
      secretAccessKey: "",
    },})
  const command = new InvokeModelWithResponseStreamCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: "application/json",
    body: body
  });
  /* const command1 = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: "application/json",
    body: body
  }); */
  //const response = await bedrock.send(command1);
  
  const res = await bedrock.send(command);

  /* if (res.status !== 200) {
    const statusText = res.statusText
    const responseBody = await res.text()
    console.error(`OpenAI API response error: ${responseBody}`)
    throw new Error(
      `The OpenAI API has encountered an error with a status code of ${res.status} ${statusText}: ${responseBody}`
    )
  }
 */
  return new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        
        console.log("plz work event",event)
        if (event.type === 'event') {
          const data = event.data

          if (data === '[DONE]') {
            controller.close()
            return
          }

          try {
            const json = JSON.parse(data)
            const text = json.choices[0]?.delta?.content
            if (text !== undefined) {
              const queue = encoder.encode(text)
              controller.enqueue(queue)
            } else {
              console.error('Received undefined content:', json)
            }
          } catch (e) {
            console.error('Error parsing event data:', e)
            controller.error(e)
          }
        }
      }

      const parser = createParser(onParse)

      for await (const item of res.body as any) {
        console.log("item.chunk",decoder.decode(item.chunk))
        console.log("item",decoder.decode(item))
        const str = decoder.decode(item.chunk.bytes);
        //const str = decoder.decode(item)
        parser.feed(decoder.decode(item))
        parser.feed(decoder.decode(item.chunk))
        parser.feed(str)
      }
    }
  })
}