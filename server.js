var express = require('express');
var app = express();
var mysql = require('mysql');
var cors = require('cors');
var unserialize = require('locutus/php/var/unserialize');
var apicache = require('apicache');
var cache = apicache.middleware;
var port = process.env.PORT || 1337;

app.use(cors());
// app.use(cache('5 minutes'));

var pool = mysql.createPool({
    // connectionLimit: 10,
    host: 'knowyourhoods.fi',
    user: 'knowyedf_wp1',
    password: 'S.TS9dBPtCcAUlQjTv624',
    database: 'knowyedf_wp1'
});

var server = app.listen(port, () => {
    var port = server.address().port;

    console.log("app listening at port " + port);

});

function getFeaturedImage(post_id, meta_key){

    return new Promise((resolve, reject) => {

        let query = 'SELECT meta_value FROM wp_postmeta WHERE meta_key="_wp_attachment_metadata" AND post_id=(SELECT meta_value FROM wp_postmeta WHERE post_id="'+post_id+'" AND meta_key="_thumbnail_id")';

        pool.query(query, (error, results, fields) => {

            if(error){
                console.log(error);
                resolve(error);
            }

            else{

                let value = unserialize(results[0].meta_value);

                resolve(value);

            }
            
    
        });

    });
    

}

app.get('/posts', async (req, res) => {

    let authorQuery = 'SELECT postmeta.meta_value FROM wp_usermeta postmeta WHERE user_id=posts.post_author AND meta_key="nickname"';
    let featuredImageQuery = 'SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE meta_key="_wp_attachment_metadata" AND post_id=(SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE post_id=posts.ID AND meta_key="_thumbnail_id")';

    pool.query('SELECT ID, posts.post_date, posts.post_title, posts.post_name, posts.post_excerpt, ('+ featuredImageQuery +') as post_thumbnail, ('+ authorQuery +') as post_author FROM wp_posts posts WHERE post_type="post" AND post_status="publish" ORDER BY post_date DESC', (error, results, fields) => {

        if(error){
            console.log(error);
            res.end(JSON.stringify(error));
        }
        else{
            results.forEach((item,index) => {

                let thumbnail = unserialize(item.post_thumbnail);
    
                let f = thumbnail.file.split('/');
                thumbnail['base_url'] = 'https://blog.hoods.fi/wp-content/uploads/' + f[0] + '/' + f[1] + '/';
    
                results[index].post_thumbnail = thumbnail;
    
            });
    
            res.end(JSON.stringify(results));
        }

    });

});

app.get('/posts/:slug', async (req, res) => {

    pool.query('SELECT ID, post_date, post_title, post_name, post_author, post_excerpt, post_content FROM wp_posts WHERE post_type="post" AND post_status="publish" AND post_name="' + req.params.slug + '"', (error, results, fields) => {

        if(error){
            console.log(error);
            res.end(JSON.stringify(error));
        }
        else{

            let post = results[0];

            res.end(JSON.stringify(post));

        }
    });

});

app.get('/posts/:post_id/image', async (req, res) => {

    getFeaturedImage(req.params.post_id).then(image => {
/*         let f = image.file.split('/');
        let featuredImage = {
            url: 'https://blog.hoods.fi/wp-content/uploads/' + f[0] + '/' + f[1] + '/' + image.sizes.medium_large.file
        } */
        res.end(JSON.stringify(image));
    })

});

app.get('/authors/:user_id', async (req, res) => {

    pool.query('SELECT meta_key, meta_value FROM wp_usermeta WHERE user_id="'+ req.params.user_id +'"', (error, results, fields) => {

        if(error){
            console.log(error);
            res.end(JSON.stringify(error));
        }
        else{

            let object = {};
            let items = ['first_name', 'last_name', 'nickname', 'email', 'description'];
            results.filter((item)=>{
                return items.includes(item.meta_key);
            }).forEach((item) => {
                object[item.meta_key] = item.meta_value
            });
    
            res.end(JSON.stringify(object));

        }

    });

});