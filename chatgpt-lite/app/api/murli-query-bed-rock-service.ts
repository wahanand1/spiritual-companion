import { BedrockAgentRuntimeClient, RetrieveCommand, RetrieveCommandInput } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import orderBy from 'lodash/orderBy';
import { hasOnlyHindiCharacters } from './utils'
import translate from "google-translate-api-x";


const system_prompt = `
You are a language translator that specializes in translating text from English to Hindi. Your translations should follow these rules:

Always translate any given input from English to Hindi.
If the input contains a mix of English and Hindi, translate the English parts while keeping the Hindi parts intact.
For inputs in Hinglish (transliterated Hindi), provide the translation in proper Hindi.Do not output preamble or explanations.
Example inputs and translations:

Input: "What is soul?"
Output: "आत्मा क्या है?"
Input: "The book is very interesting. इसे पढ़ना चाहिए।"
Output: "यह किताब बहुत दिलचस्प है। इसे पढ़ना चाहिए।"
Input: "Kya yeh possible hai?"
Output: "क्या यह संभव है?"
`
export async function murliRagRetrieve(query:string):Promise<string|undefined> {
  
    query = query.replace('?','').replace('.','')
    let isHindi = hasOnlyHindiCharacters(query)
    console.log("query :", query)
    console.log("isHindi",isHindi)
    if(!isHindi)
    {
      const response = await translate(query, {
        from: "en",
        to: "hi"
      });
      //const correctedText = response.from.text.value.replace(/\[([a-z]+)\]/gi, "$1"); 
      //const finalRes = await translate(correctedText, { from: "en", to: "hi" });
      query = response.text
      console.log("final text",response.text); 
      console.log(response.from.language.iso);
      

    }
    
    const client = getBedRockClient();
    //const bedrock= new BedrockRuntime({ region: "us-east-1" })
    
    const command = buildCommand(query)
    const response = await client.send(command);

    
    let re_rankeditem = orderBy(response.retrievalResults,'score', 'desc')
    //build a prompt using the relevant results from the response.retrievalResults
    
    let resultcount = 1;
    const chunks = [];
    for (const result of re_rankeditem!) {
            if(result && result.content)
            {
                const chunkText:string = `\nMurli references ${resultcount}.${result.content.text}\n. <a href="${result.location!.s3Location!.uri!.replace("s3://av-baba-murli", "https://av-baba-murli.s3.us-east-1.amazonaws.com")}" target="_blank" style="text-decoration:none;color:red">click here</a> for detail murli\n `;
                resultcount += 1;
                chunks.push(chunkText);
            }
        }
    return chunks.join("")
      
    }

function getBedRockClient():BedrockAgentRuntimeClient
    {
     
    //const fundation_model_ARN = process.env.FM_ARN
    const accessKeyId = process.env.ACCESS_KEY_ID 
    const secretAccessKey = process.env.SECRRET_ACCESS_KEY
    const region =  process.env.REGION
    return new BedrockAgentRuntimeClient({ region: region ,
           credentials: {
             accessKeyId: accessKeyId!, // permission to invoke agent
             secretAccessKey: secretAccessKey!,
           },});

    }

function buildCommand(query:string):RetrieveCommand
{
  const knowledgeBaseID = process.env.KNOWLEDGE_BASE_ID
  const input:RetrieveCommandInput = { // RetrieveRequest
    'knowledgeBaseId': knowledgeBaseID, // required
    'retrievalQuery': { // KnowledgeBaseQuery
      'text': query, // required
    },
    'retrievalConfiguration': { // KnowledgeBaseRetrievalConfiguration
      'vectorSearchConfiguration': { // KnowledgeBaseVectorSearchConfiguration
        'numberOfResults': 5,
        'overrideSearchType':"HYBRID"
      },
    },
  };

return new RetrieveCommand(input);
}

async function translateInputToHindi(query:string):Promise<string>
{
  return await getTranslatedQueryFromModel(query)
  
}
async function  getTranslatedQueryFromModel(input: string) {
  
  let prompt_config = {
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 4096,
    "temperature":0,
    "system": system_prompt,
    "messages":[
      {"role": "user", "content":input}
  ]
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


  const command = new InvokeModelCommand({
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
  
  const response = await bedrock.send(command);
  
  let decoder = new TextDecoder();
  let result = JSON.parse(decoder.decode(response.body));

  console.log("my response",result.content[0].text)
 
  return result.content[0].text
  /* if (res.status !== 200) {
    const statusText = res.statusText
    const responseBody = await res.text()
    console.error(`OpenAI API response error: ${responseBody}`)
    throw new Error(
      `The OpenAI API has encountered an error with a status code of ${res.status} ${statusText}: ${responseBody}`
    )
  }
 */
     
}

/* 
let client_knowledgebase = client.retrieve_and_generate(
    input={
        'text': user_query
    },
    retrieveAndGenerateConfiguration={
        'type': 'KNOWLEDGE_BASE',
        'knowledgeBaseConfiguration': {
            'generationConfiguration': {
                'inferenceConfig': {
                    'textInferenceConfig': {
                        'maxTokens': 2048,
                        'stopSequences': [
                            '\nObservation',
                        ],
                        'temperature': 0.1,
                        'topP': 1
                    }
                },
                'promptTemplate': {
                    'textPromptTemplate': system_prompt
                }
            },
            'knowledgeBaseId': knowledgeBaseID,
            'modelArn': fundation_model_ARN,
            'orchestrationConfiguration': {
                'queryTransformationConfiguration': {
                    'type': 'QUERY_DECOMPOSITION'
                }
            },
            'retrievalConfiguration': {
                'vectorSearchConfiguration': {
                    'numberOfResults': 5,
                }
            }
        },
        
    },
    
)
 */




