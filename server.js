var express = require('express');
var app = express();
var mysql = require('mysql');
var md5 = require('md5')
var cors = require('cors');
var unserialize = require('locutus/php/var/unserialize');
var apicache = require('apicache');
var compression = require('compression');
var cache = apicache.middleware;
var port = process.env.PORT || 1337;

app.use(cors());
app.use(compression());
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

    let fields = 'yoast.title, yoast.description, yoast.twitter_title, yoast.twitter_image, yoast.twitter_description, yoast.open_graph_title, yoast.open_graph_description, yoast.open_graph_image';
    let featuredImageQuery = 'SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE meta_key="_wp_attachment_metadata" AND post_id=(SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE post_id=posts.ID AND meta_key="_thumbnail_id")';

    pool.query('SELECT posts.ID, posts.post_date, posts.post_title, posts.post_name, posts.post_author, posts.post_excerpt, posts.post_content, ('+ featuredImageQuery +') as post_thumbnail, ' + fields + ' FROM wp_posts posts LEFT OUTER JOIN wp_yoast_indexable yoast ON yoast.object_id = posts.ID WHERE post_type="post" AND posts.post_status="publish" AND posts.post_name="' + req.params.slug + '"', (error, results, fields) => {

        if(error){
            console.log(error);
            res.end(JSON.stringify(error));
        }
        else{

            let post = results[0];

            let thumbnail = unserialize(post.post_thumbnail);
            let f = thumbnail.file.split('/');
            thumbnail['base_url'] = 'https://blog.hoods.fi/wp-content/uploads/' + f[0] + '/' + f[1] + '/';
            post['post_thumbnail'] = thumbnail;

            res.end(JSON.stringify(post));

        }
    });

});

app.get('/authors/:id', async (req, res) => {

    let keys = ['first_name', 'last_name', 'description', 'nickname'];
    let id = req.params.id;

    let queries = [];
    keys.forEach(key => {
        let item = `meta_key = "${key}"`
        queries.push(item);
    });
    let queryString = queries.join(' OR ');

    pool.query(`SELECT meta_key, meta_value, (SELECT user_email FROM wp_users WHERE ID = "${id}") as email FROM wp_usermeta WHERE user_id = "${id}" AND (${queryString})`, (error, results, fields) => {

        if(error){
            console.log(error);
            res.end(JSON.stringify(error));
        }
        else{

            let author = {};
            results.forEach((meta) => {
                author[meta.meta_key] = meta.meta_value;
            });
            author['email'] = results[0].email;
            author['avatar'] = 'http://gravatar.com/avatar/' + md5(author.email) + '?s=120&d=mm';

            

            res.end(JSON.stringify(author));

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