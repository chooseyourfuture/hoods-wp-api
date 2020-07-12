require('dotenv').config();
const nodeCache = require('node-cache');
const cache = new nodeCache({ stdTTL: process.env.API_CACHE_TIME * 60 });

function getUrlFromRequest(req){
    const url = req.protocol + '://' + req.headers.host + req.originalUrl;
    return url;
}

function set(req, res, next){
    const url = getUrlFromRequest(req);
    cache.set(url, res.locals.data);
    console.log('Setting cache');
    return next();
}

function get(req, res, next){
    const url = getUrlFromRequest(req);
    const content = cache.get(url);
    if(content){
        console.log('Getting cache from memory.');
        return res.status(200).send(content)
    }
    else{
        console.log('Continuing with the query.');
        return next();
    }
}

module.exports = { get, set }