<?php
/**
 * Template Name: Hoods RSS feed
 */
$lang = "en";
$postCount = 5; // The number of posts to show in the feed
$posts = query_posts('showposts=' . $postCount);
header('Content-Type: '.feed_content_type('rss-http').'; charset='.get_option('blog_charset'), true);
echo '<?xml version="1.0" encoding="'.get_option('blog_charset').'"?'.'>';
?>
<rss version="2.0"
        xmlns:content="http://purl.org/rss/1.0/modules/content/"
        xmlns:wfw="http://wellformedweb.org/CommentAPI/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:atom="http://www.w3.org/2005/Atom"
        xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
        xmlns:slash="http://purl.org/rss/1.0/modules/slash/"
        <?php do_action('rss2_ns'); ?>>
<channel>
        <title><?php bloginfo_rss('name'); ?> - Feed</title>
        <atom:link href="<?php self_link(); ?>" rel="self" type="application/rss+xml" />
        <link>https://hoods.fi/blog</link>
        <description><?php bloginfo_rss('description') ?></description>
        <lastBuildDate><?php echo mysql2date('D, d M Y H:i:s +0000', get_lastpostmodified('GMT'), false); ?></lastBuildDate>
        <language><?php echo $lang; ?></language>
        <sy:updatePeriod><?php echo apply_filters( 'rss_update_period', 'hourly' ); ?></sy:updatePeriod>
        <sy:updateFrequency><?php echo apply_filters( 'rss_update_frequency', '1' ); ?></sy:updateFrequency>
        <?php do_action('rss2_head'); ?>
        <?php while(have_posts()) : the_post(); ?>
                <item>
                        <title><?php echo parse_lang(get_the_title_rss(), $lang); ?></title>
                        <link>https://hoods.fi/blog/<?php echo basename( get_permalink() ); ?></link>
                        <pubDate><?php echo mysql2date('D, d M Y H:i:s +0000', get_post_time('Y-m-d H:i:s', true), false); ?></pubDate>
                        <dc:creator><?php the_author(); ?></dc:creator>
                        <guid isPermaLink="false">https://hoods.fi/blog/<?php echo basename( get_permalink() ); ?></guid>
                        <description><![CDATA[<?php echo get_the_post_thumbnail( $post->ID, 'medium', array( 'style' => 'float:right; margin:0 0 10px 10px;' ) ); ?><?php echo parse_lang(get_the_excerpt(), $lang); ?>]]></description>
                        <content:encoded><![CDATA[<?php echo get_the_post_thumbnail( $post->ID, 'medium', array( 'style' => 'float:right; margin:0 0 10px 10px;' ) ); ?><?php echo parse_lang(get_the_excerpt(), $lang); ?>]]></content:encoded>
                        <?php rss_enclosure(); ?>
                        <?php do_action('rss2_item'); ?>
                </item>
        <?php endwhile; ?>
</channel>
</rss>