<?php
/**
 * Plugin Name: KYH WP extension
 * Plugin URI: http://hoods.fi
 * Description: Adds some functions like comment voting and prev/next article to the native Wordpress REST API.
 * Version: 1.0.1
 * Author: Juho Vainio
 * Author URI: http://jokojo.fi
 */

// Register custom fields for comments

add_action('rest_api_init', 'add_voting_api');

function comment_vote( WP_REST_request $data){

	$id = $data['id'];
	$dir = $data['dir'];

	$user_ip = $_SERVER['REMOTE_ADDR'];
	$user_agent = $data->get_header('user_agent');

	$user_id = md5(hash('sha256', $user_ip.' '.$user_agent ));

	$datetime = new DateTime('NOW');

	if(strlen($id) > 0){
		$current = get_comment_meta($id, 'votes');

		$dir_int = 0;

		if($dir == 'up'){
			$new = $current[0] + 1;
			update_comment_meta($id, 'votes', $new);
			$dir_int = 1;
		}
		elseif($dir == 'down'){
			$new = $current[0] - 1;
			update_comment_meta($id, 'votes', $new);
			$dir_int = -1;
		}

		return register_vote(array(
			"time" => $datetime->format('Y-m-d H:i:s'),
			"user_type" => "guest",
			"user_identifier" => $user_id,
			"target_type" => "comment",
			"target_id" => $id,
			"vote_direction" => $dir_int,
		),array(
			"%s",
			"%s",
			"%s",
			"%s",
			"%d",
			"%d",
		));
	}
	else{
		return 'failed';
	}
}

function get_comment_votes($object){
	global $wpdb;

	$table_name = $wpdb->prefix . "voting";

	$count_up = $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE target_id='".$object['id']."' AND target_type='comment' AND vote_direction=1 ");
	$count_down = $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE target_id='".$object['id']."' AND target_type='comment' AND vote_direction=-1 ");

	return array(
		"upvotes" => $count_up,
		"downvotes" => $count_down
	);
}

function add_voting_api(){
	register_rest_route('voting', '/vote',
		array(
			'methods' => WP_REST_Server::EDITABLE,
			'callback' => 'comment_vote'
		)
	);

	register_rest_field('comment', 'votes', array(
		'get_callback' => 'get_comment_votes',
		'update_callback' => null,
		'schema' => null
	));
}

// Allow commenting through wp-json
function filter_rest_allow_anonymous_comments() {
    return true;
}
add_filter('rest_allow_anonymous_comments','filter_rest_allow_anonymous_comments');

// Register newsletter field for comments posted through REST
add_action('rest_api_init', 'add_newsletter_field');
function add_newsletter_field(){
	register_rest_field('comment', 'newsletter', array(
		'get_callback' => null,
		'update_callback' => function( $newsletter, $comment_obj ) {
            $ret = add_comment_meta( $comment_obj->comment_ID, 'newsletter', $newsletter );
            if ( false === $ret ) {
                return new WP_Error(
                  'rest_comment_newsletter_failed',
                  __( 'Failed to update comment newsletter field.' ),
                  array( 'status' => 500 )
                );
            }
            return true;
        },
		'schema' => null
	));
}

// Display newsletter field in comment list
add_filter( 'manage_edit-comments_columns', 'custom_comment_columns' );
function custom_comment_columns( $columns ) {
  $columns['newsletter'] = __( 'Uutiskirje' );
  return $columns;
}

add_action( 'manage_comments_custom_column', 'custom_comment_column', 10, 2);
function custom_comment_column( $column, $comment_id ) {
  // Image column
  if ( 'newsletter' === $column ) {
    echo get_comment_meta( $comment_id, 'newsletter', true );
  }
}

add_filter( 'manage_edit-comments_sortable_columns', 'register_sortable_columns' );
function register_sortable_columns( $columns ) {
    $columns['newsletter'] = 'Uutiskirje';
    return $columns;
}

add_action( 'add_meta_boxes_comment', 'comment_add_meta_box' );
function comment_add_meta_box()
{
 add_meta_box( 'newsletter', __( 'Uutiskirje' ), 'comment_meta_box_newsletter',     'comment', 'normal', 'high' );
}
function comment_meta_box_newsletter( $comment )
{
    $title = str_replace(' ', '', get_comment_meta( $comment->comment_ID, 'newsletter', true ));

   ?>
 <p>
     <label for="newsletter"><?php _e( 'Uutiskirje' ); ?></label>:
     <?php echo esc_attr( $title ); ?>
 </p>
 <?php
}
add_action( 'edit_comment', 'comment_edit_function' );
function comment_edit_function( $comment_id )
{
    if( isset( $_POST['newsletter'] ) ){
		$res = str_replace(' ', '', esc_attr( $_POST['newsletter'] ) );
      	update_comment_meta( $comment_id, 'newsletter', $res );
	}
}


function voting_setup(){
	global $wpdb;

	$table_name = $wpdb->prefix . "voting";
	$charset_collate = $wpdb->get_charset_collate();

	require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

	$sql = "CREATE TABLE $table_name (
		id mediumint(9) NOT NULL AUTO_INCREMENT,
		time datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
		user_type varchar(55) DEFAULT 'guest' NOT NULL,
		user_identifier varchar(55) DEFAULT '0.0.0.0' NOT NULL,
		target_type varchar(55) DEFAULT 'post' NOT NULL,
		target_id int(55) DEFAULT '0' NOT NULL,
		vote_direction int(10) DEFAULT '0' NOT NULL,
		PRIMARY KEY  (id)
	  ) $charset_collate;";
	  maybe_create_table($table_name, $sql);
}

function register_vote($data, $format){
	global $wpdb;

	$table_name = $wpdb->prefix . "voting";

	if(check_vote($data) > 0){
		// If vote is same, set vote to 0
		if($data['vote_direction'] == $wpdb->get_var("SELECT vote_direction FROM $table_name WHERE user_identifier='".$data['user_identifier']."' AND target_id='".$data['target_id']."' ")){
			$data['vote_direction'] = 0;
		}
		$wpdb->update($table_name, $data, array('user_identifier' => $data['user_identifier'], 'target_id' => $data['target_id']), $format);
		return "User already voted. Update vote." + $results;
	}
	else{
		return $wpdb->insert($table_name, $data, $format);
	}
	
}

function check_vote($data){
	global $wpdb;

	$table_name = $wpdb->prefix . "voting";

	$count = $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE user_identifier='".$data['user_identifier']."' AND target_id='".$data['target_id']."' ");
	return $count;
}

add_action('after_setup_theme', 'voting_setup');

// Add filter to respond with next and previous post in post response.
add_filter( 'rest_prepare_post', function( $response, $post, $request ) {
	
	global $post;
	// Get the so-called next post.
	$next = get_adjacent_post( false, '', false );
	// Get the so-called previous post.
	$previous = get_adjacent_post( false, '', true );
	// Format them a bit and only send id and slug (or null, if there is no next/previous post).
	$response->data['next'] = ( is_a( $next, 'WP_Post') ) ? array( "id" => $next->ID, "slug" => $next->post_name ) : null;
	$response->data['previous'] = ( is_a( $previous, 'WP_Post') ) ? array( "id" => $previous->ID, "slug" => $previous->post_name ) : null;
  
	return $response;
  }, 10, 3 );

// Customize the RSS feed to support multi-language content
add_action('init', 'hoodsRSS');

function hoodsRSS(){
	add_feed('fi', 'generateFiRSS');
	add_feed('en', 'generateEnRSS');
}

add_filter('wp_feed_cache_transient_lifetime', function () { return 0; });

function parse_lang( $string, $lang ){
	preg_match('/{{lang:'.$lang.'}}(.*){{\/lang:'.$lang.'}}/', $string, $results);
	return $results[1];
}

function generateFiRSS(){
	include plugin_dir_path( __FILE__ ) . 'templates/rss-fi.php';
}

function generateEnRSS(){
	include plugin_dir_path( __FILE__ ) . 'templates/rss-en.php';
}

add_filter( 'rest_comment_collection_params', 'change_comment_limit', 10, 1 );

function change_comment_limit( $params ) {
    if ( isset( $params['per_page'] ) ) {
        $params['per_page']['maximum'] = 999;
    }

    return $params;
}