require('dotenv').config();
var express = require('express');
var app = express();
var mysql = require('mysql');
var md5 = require('md5')
var cors = require('cors');
var unserialize = require('locutus/php/var/unserialize');
var compression = require('compression');
var port = process.env.PORT || 1337;
var cache = require('./middlewares/cache');

app.use(cors());
app.use(compression());

var pool = mysql.createPool({
    // connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
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

app.get('/posts', cache.get, async (req, res, next) => {

    let authorQuery = 'SELECT postmeta.meta_value FROM wp_usermeta postmeta WHERE user_id=posts.post_author AND meta_key="nickname"';
    let featuredImageQuery = 'SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE meta_key="_wp_attachment_metadata" AND post_id=(SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE post_id=posts.ID AND meta_key="_thumbnail_id")';
    // AND post_status="publish"
    pool.query('SELECT ID, posts.post_date, posts.post_title, posts.post_name, posts.post_excerpt, ('+ featuredImageQuery +') as post_thumbnail, ('+ authorQuery +') as post_author FROM wp_posts posts WHERE post_type="post" ORDER BY post_date DESC', (error, results, fields) => {

        if(error){
            console.log(error);
            res.end(JSON.stringify(error));
        }
        else{
            results.forEach((item,index) => {

                // Check for post thumbnail
                results[index]['post_thumbnail'] = formatThumbnail(item.post_thumbnail);
                /* if(item.post_thumbnail !== undefined){
                    let thumbnail = unserialize(item.post_thumbnail);
    
                    let f = thumbnail.file.split('/');
                    thumbnail['base_url'] = process.env.BASE_URL + '/wp-content/uploads/' + f[0] + '/' + f[1] + '/';
    
                    results[index].post_thumbnail = thumbnail;
                }
                else{
                    results[index]['post_thumbnail'] = null;
                } */
    
            });
    
            res.locals.data = JSON.stringify(results);
            return next();
        }

    });

}, cache.set, (req, res) => {
    res.end(res.locals.data);
});

app.get('/posts/:slug', cache.get, async (req, res, next) => {

    let fields = 'yoast.title, yoast.description, yoast.twitter_title, yoast.twitter_image, yoast.twitter_description, yoast.open_graph_title, yoast.open_graph_description, yoast.open_graph_image';
    let featuredImageQuery = 'SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE meta_key="_wp_attachment_metadata" AND post_id=(SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE post_id=posts.ID AND meta_key="_thumbnail_id")';

    let nextPost = 'SELECT posts2.post_name FROM wp_posts posts2 WHERE post_type="post" AND post_status="publish" AND post_date > posts.post_date ORDER BY post_date LIMIT 1';
    let prevPost = 'SELECT posts2.post_name FROM wp_posts posts2 WHERE post_type="post" AND post_status="publish" AND post_date < posts.post_date ORDER BY post_date DESC LIMIT 1';

    pool.query('SELECT posts.ID, posts.post_date, posts.post_title, posts.post_name, posts.post_author, posts.post_excerpt, posts.post_content, ('+ featuredImageQuery +') as post_thumbnail, (' + prevPost + ') as previous, (' + nextPost + ') as next, ' + fields + ' FROM wp_posts posts LEFT OUTER JOIN wp_yoast_indexable yoast ON yoast.object_id = posts.ID WHERE post_type="post" AND posts.post_status="publish" AND posts.post_name="' + req.params.slug + '"', (error, results, fields) => {

        if(error){
            console.log(error);
            res.end(JSON.stringify(error));
        }
        else{

            let post = results[0];

            /* let thumbnail = unserialize(post.post_thumbnail);
            let f = thumbnail.file.split('/');
            thumbnail['base_url'] = process.env.BASE_URL + '/wp-content/uploads/' + f[0] + '/' + f[1] + '/'; */
            post['post_thumbnail'] = formatThumbnail(post.thumbnail);

            let content = post['post_content'].replace(/\"\/wp-content\//g, '"' + process.env.BASE_URL + '/wp-content/');

            post['post_content'] = content;

            res.locals.data = JSON.stringify(post);
            return next();

        }
    });

}, cache.set, (req, res) => {
    res.end(res.locals.data);
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

// Get category posts by category slug

app.get('/categories/:slugs/posts', async(req, res, next) => {

    let slugs = req.params.slugs.split(',');
    slugs.forEach((slug, index) => {
        slugs[index] = '"' + slug + '"';
    });

    let authorQuery = 'SELECT postmeta.meta_value FROM wp_usermeta postmeta WHERE user_id=posts.post_author AND meta_key="nickname"';
    let featuredImageQuery = 'SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE meta_key="_wp_attachment_metadata" AND post_id=(SELECT postmeta.meta_value FROM wp_postmeta postmeta WHERE post_id=posts.ID AND meta_key="_thumbnail_id")';

    let taxonomyQuery = 'SELECT term_taxonomy_id FROM wp_terms INNER JOIN wp_term_taxonomy ON wp_terms.term_id = wp_term_taxonomy.term_id WHERE wp_terms.slug IN (' + slugs.join(', ') + ') AND wp_term_taxonomy.taxonomy="category"';
    let postIDQuery = 'SELECT object_id FROM wp_term_relationships WHERE term_taxonomy_id IN (' + taxonomyQuery + ') GROUP BY object_id HAVING COUNT(*) > ' + (slugs.length-1);

    // let postQuery = 'SELECT * FROM wp_posts WHERE post_type="post" AND post_status="publish" AND ID IN (' + postIDQuery + ')';

    let postQuery = 'SELECT ID, posts.post_date, posts.post_title, posts.post_name, posts.post_excerpt, ('+ featuredImageQuery +') as post_thumbnail, ('+ authorQuery +') as post_author FROM wp_posts posts WHERE post_type="post" AND post_status="publish" AND ID IN (' + postIDQuery + ') ORDER BY post_date DESC';

    pool.query(postQuery, (error, results, fields) => {
        if(error){
            console.log(error);
            res.end(JSON.stringify(error));
        }
        else{
            results.forEach((item,index) => {

                /* let thumbnail = unserialize(item.post_thumbnail);
    
                let f = thumbnail.file.split('/');
                thumbnail['base_url'] = process.env.BASE_URL + '/wp-content/uploads/' + f[0] + '/' + f[1] + '/'; */

                results[index]['post_thumbnail'] = formatThumbnail(item.post_thumbnail);
    
            });
    
            res.locals.data = JSON.stringify(results);
            // res.end(JSON.stringify(results));
            return next();
        }
    });

}, cache.set, (req, res) => {
    res.end(res.locals.data);
});

function formatThumbnail(post_thumbnail){
    if(post_thumbnail !== undefined && post_thumbnail !== null){
        let thumbnail = unserialize(post_thumbnail);

        let f = thumbnail.file.split('/');
        thumbnail['base_url'] = process.env.BASE_URL + '/wp-content/uploads/' + f[0] + '/' + f[1] + '/';

        // results[index].post_thumbnail = thumbnail;
        return thumbnail;
    }
    else{
        // results[index]['post_thumbnail'] = null;
        return null;
    }
}