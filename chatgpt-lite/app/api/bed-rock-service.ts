import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand, RetrieveCommand, RetrieveCommandInput } from "@aws-sdk/client-bedrock-agent-runtime";


let knowledgeBaseID = process.env.KNOWLEDGE_BASE_ID
let fundation_model_ARN = process.env.FM_ARN
export function getSystemPrompt():string
{
    let system_prompt = `You are a Spiritual Companion agent, designed to provide thoughtful and empathetic responses to spiritual inquiries. When a user poses a question, you will reference a provided set of search results to formulate your answers. If the search results do not contain relevant information, clearly state that you could not find an exact answer.
                            Key Responsibilities:
                                1. Empathetic Engagement: Begin each interaction with "Om Shanti." Ensure your tone is warm and nurturing, reflecting a deep understanding of the user's emotional and spiritual state.
                                2. Clarification and Exploration: For complex queries, address each part separately. After providing initial insights, invite the user to engage further by asking open-ended questions like, “Does this resonate with you?” or “Would you like to explore this more?”
                                3. Simplification: If users need clarification, simplify complex concepts using relatable analogies or examples to enhance understanding.
                                4. Guidance Consistency: Maintain the tone and language of the source material while ensuring your guidance aligns with the underlying principles and philosophies.
                                5. Information Integrity: Share concise answers based solely on the provided context, avoiding external references. Do not disclose the names of documents used for reference.

                            Example Workflow:
                                User asks a question.
                                After understanding given context, you provide a thoughtful, narrative-style response, encouraging further exploration.`
                            
        return system_prompt

}

export async function contextRagRetrieve(query:string):Promise<string> {
    const knowledgeBaseID = process.env.KNOWLEDGE_BASE_ID
    const fundation_model_ARN = process.env.FM_ARN
    const accessKeyId = process.env.ACCESS_KEY_ID 
    const secretAccessKey = process.env.SECRRET_ACCESS_KEY
    const region =  process.env.REGION
    const client = new BedrockAgentRuntimeClient({ region: region ,
           credentials: {
             accessKeyId: accessKeyId!, // permission to invoke agent
             secretAccessKey: secretAccessKey!,
           },});

    //const bedrock= new BedrockRuntime({ region: "us-east-1" })
      const input:RetrieveCommandInput = { // RetrieveRequest
        'knowledgeBaseId': knowledgeBaseID, // required
        'retrievalQuery': { // KnowledgeBaseQuery
          'text': query, // required
        },
        'retrievalConfiguration': { // KnowledgeBaseRetrievalConfiguration
          'vectorSearchConfiguration': { // KnowledgeBaseVectorSearchConfiguration
            'numberOfResults': 4,
            'overrideSearchType': 'HYBRID',
          },
        },
      };

    const command = new RetrieveCommand(input);

    const response = await client.send(command);

    const chunks = [];

    //build a prompt using the relevant results from the response.retrievalResults
    let resultcount = 1;
    for (const result of response.retrievalResults!) {
            if(result && result.content)
            {
                const chunkText:string = `${resultcount}.${result.content.text}.`;
                resultcount += 1;
                chunks.push(chunkText);
            }
        }
        let kbPrompt = getFinalPrompt(chunks.join(""),query);
        return kbPrompt;
      
    }

    function getFinalPrompt(context: string,query:string):string {

               
        return `Here are the search results and context: ${context}. Use them to answer this question : ${query}.`;

       // Contextual Inquiry: Before answering, ask additional questions to ensure you fully understand the user’s context. Only proceed to answer once you have a complete understanding.
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




