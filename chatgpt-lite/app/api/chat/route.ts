import { InvokeModelWithResponseStreamCommand,BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { NextRequest, NextResponse } from 'next/server'
import { murliRagRetrieve } from "../murli-query-bed-rock-service"


export const runtime = 'edge'

export interface Message {
  role: string
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages,input } = (await req.json()) as {
      messages: Message[]
      input: string
    }
    

    const result = await murliRagRetrieve(input);
    
    return new Response(result);
    //return new Response("This is test");
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}



