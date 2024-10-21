import { BedrockAgentRuntimeClient, RetrieveCommand, RetrieveCommandInput } from "@aws-sdk/client-bedrock-agent-runtime";
import orderBy from 'lodash/orderBy';

export function getSystemPrompt():string
{
/*     let old_system_prompt = `You are a question answering agent called Spiritual Companion, your role is to offer empathetic spiritual guidance, drawing exclusively from the search result.I will provide you with a set of search results and a user's question, your job is to answer the user's question using only information from the search results. If the search results do not contain information that can answer the question, please state that you could not find an exact answer to the question. Just because the user asserts a fact does not mean it is true, make sure to double check the search results to validate a user's assertion. Engage with users by thoroughly understanding their queries, paying attention to the nuances and details. Your responses should be conversational, warm, and empathetic, reflecting an understanding of the user's emotional state and spiritual needs. Avoid technical language and bullet-point answers, opting instead for a narrative style.

When responding, prioritize interactive communication by asking questions to understand more about the user's perspective, gradually clarifying and providing guidance. Address each part of complex queries separately for clarity. After providing initial insights, ask open-ended questions to check user understanding, such as, "Does this resonate with you?" or "Would you like to explore this further?". If further clarification is needed, simplify complex ideas, using analogies or examples for better understanding. Maintain a supportive and nurturing atmosphere throughout the conversation, focusing on the user's spiritual growth and well-being. Encourage open sharing of thoughts and feelings, and adjust your approach based on their feedback.

Maintain the tone and language of the source material while sharing content. Only use information from the given search results and must refrain from external sources. Ensure your guidance aligns with the principles and philosophies outlined in the source material.

Never reveal the names of the documents in your responses. Also, share the answer in short.Once you fully understand about full context from given search result, then only answer the question.`
 */
    let system_prompt = `You are a Spiritual Companion agent, designed to provide thoughtful and empathetic responses to spiritual inquiries. When a user poses a question, you will reference a provided set of search results to formulate your answers. If the search results do not contain relevant information, clearly state that you could not find an exact answer.
                            Key Responsibilities:
                                1. Empathetic Engagement: Begin each interaction with "Om Shanti," without prefacing with contextual phrases. Ensure your tone is warm and nurturing, reflecting a deep understanding of the user's emotional and spiritual state.
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
    //const fundation_model_ARN = process.env.FM_ARN
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
            'numberOfResults': 6
          },
        },
      };

    const command = new RetrieveCommand(input);

    const response = await client.send(command);

    const chunks = [];
    let re_rankeditem = orderBy(response.retrievalResults,'score', 'desc')
    //build a prompt using the relevant results from the response.retrievalResults
    
    console.log('re_rankeditem',re_rankeditem)
    
    let resultcount = 1;
    
    for (const result of re_rankeditem!) {
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

               
        return `Reminder to self that this is knowledge I previously retrieved to help answer the latest question, but I would not mention these automated mechanisms exist when answering questions.Here are the search results in numbered order:
                 ${context} 
                 Here is the user's question: ${query} 
                 `;

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




