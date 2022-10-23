const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 8080;

const axios = require('axios');

const Joi = require('joi'); 

// Load wink-nlp package  & helpers.
const winkNLP = require( 'wink-nlp' );
const its = require( 'wink-nlp/src/its.js' );
const model = require( 'wink-eng-lite-web-model' );
const nlp = winkNLP( model );

const { stripHtml } = require("string-strip-html");



app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());



const getBodyFromURL=  async (url) =>{

    // Web  Scraping 

    const scraperapiClient = await require('scraperapi-sdk')('fba13f698db4a3b8cfafc9ba8bd7c90d')
    
    const executeScraping = await scraperapiClient.get(url); 

    const parsedHTML = await stripHtml(executeScraping, {
        stripTogetherWithTheirContents: [
          "script", // default
          "style", // default
          "xml", // default
          "pre", // <-- custom-added
          "footer",
          "header",
          "nav",
          "ul",
          "li",
          "span"
        ],
      }).result;

       
      return parsedHTML; 




}

 
const analyzeSentimentSentence =  async (sentence) =>{

    const options = {
        method: 'POST',
        url: 'https://api-inference.huggingface.co/models/Jhonatan51998/toxicity_sentiment_model',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer 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'
        },
        data: {inputs: sentence}
    };
    try {
        // axios automatically serializes the payload to JSON.
        // no need to JSON.stringify({ userid: 42, ...})
        const res = await axios.request(options)

        return res.data;
   } catch(error) {
        console.log(error)
        return 'ERROR';
   }
} 

 const analyzeBiasSentence =  async (sentence) =>{

        const options = {
            method: 'POST',
            url: 'https://api-inference.huggingface.co/models/Jhonatan51998/bias_model',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer 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'
            },
            data: {inputs: sentence}
        };
        try {
            // axios automatically serializes the payload to JSON.
            // no need to JSON.stringify({ userid: 42, ...})
            const res = await axios.request(options)

            return res.data;
       } catch(error) {
            console.log(error)
            return 'ERROR';
       }
} 

app.post('/analyze', async (req, res) => {

    let sentencesAnalyzed = [];
     
    try {
    // Validar input 
    const { body } = req; 
    const analyzeSchema = Joi.object().keys({ 
        type: Joi.string().required(),
        text: Joi.string(), 
        url: Joi.string().uri() 
    }); 
    
    const { error } = analyzeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Variables  

    if(req.body.type == 'url') { 

        const resultScraping = await getBodyFromURL(req.body.url);

        // Read text
        const doc = await nlp.readDoc(resultScraping);
        // Extract sentences from the data
        const sentences = await doc.sentences().out();

        // Recorremos el array 
        
        for (const sentence of sentences) {
            console.log(sentence); 

            const sentenceResultSesgo = await analyzeBiasSentence(sentence)
            const sentenceResultSentiment = await analyzeSentimentSentence(sentence);
            sentencesAnalyzed.push({ sentence: sentence, sesgo: sentenceResultSesgo, sentiment: sentenceResultSentiment});

            console.log(sentenceResultSesgo);
        }

        
        return res.status(200).json({ textFromURL: resultScraping, result: sentencesAnalyzed})


    }

    if (req.body.type == 'text') {

        
    // Read text
    const doc = nlp.readDoc( req.body.text );
    // Extract sentences from the data
    const sentences = await doc.sentences().out();

    // Recorremos el array 
      
    for (const sentence of sentences) {
        console.log(sentence); 

        const sentenceResultSesgo = await analyzeBiasSentence(sentence)
        const sentenceResultSentiment = await analyzeSentimentSentence(sentence); 


        var textForSesgo = ''; 
        var textSentiment = '';

         console.log(sentenceResultSesgo[0][0].labe); 

         if(sentenceResultSesgo[0][0].label=='Sesgado') {
            textForSesgo = 'Sesgado: ' + Math.round(sentenceResultSesgo[0][0].score,3) + ' / No sesgado: '+ Math.round(sentenceResultSesgo[0][1].score,3);
         }

         else {
            textForSesgo = 'Sesgado: ' + Math.round(sentenceResultSesgo[0][1].score,3) + ' / No sesgado: '+ Math.round(sentenceResultSesgo[0][0].score,3);
        } 


        if(sentenceResultSentiment[0][0].label=='Positivo') {
            textSentiment = 'Positivo: ' + Math.round(sentenceResultSentiment[0][0].score,3) + ' / Negativo: '+ Math.round(sentenceResultSentiment[0][1].score,3);
         }

         else {
            textSentiment = 'Positivo: ' + Math.round(sentenceResultSentiment[0][1].score,3) + ' / Negativo: '+ Math.round(sentenceResultSentiment[0][0].score,3);
        } 



    

        sentencesAnalyzed.push({ sentence: sentence, sesgo: textForSesgo, sentiment: textSentiment});

        console.log(sentenceResultSesgo);
    }
  
    return res.status(200).json({ result: sentencesAnalyzed})


    }
        
    


    // Devolver 
    } catch (error) {
      
        console.log(error)

        return res.status(500).json({ error})
    }


});

app.listen(port, () => console.log(`Sesgus API on port ${port}!`));