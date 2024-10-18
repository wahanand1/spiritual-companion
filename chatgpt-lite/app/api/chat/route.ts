import { InvokeModelWithResponseStreamCommand,BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { NextRequest, NextResponse } from 'next/server'
import {contextRagRetrieve,getSystemPrompt} from "../bed-rock-service"


export const runtime = 'edge'

export interface Message {
  role: string
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { input } = (await req.json()) as {
      input: string
    }
    

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

async function*  getBedRockAIStream(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Message[]
) {
  
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
