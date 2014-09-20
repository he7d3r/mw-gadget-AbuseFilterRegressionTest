/**
 * Improves [[Special:AbuseFilter/test]] to allow regression testing of the filters
 * @author: Helder (https://github.com/he7d3r)
 * @license: CC BY-SA 3.0 <https://creativecommons.org/licenses/by-sa/3.0/>
 */
/*jshint browser: true, camelcase: true, curly: true, eqeqeq: true, immed: true, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, quotmark: true, undef: true, unused: true, strict: true, trailing: true, maxlen: 120, laxbreak: true, devel: true, evil: true, onevar: true */
/*global jQuery, mediaWiki */
( function ( mw, $ ) {
'use strict';

/* Translatable strings */
mw.messages.set( {
	// [[MediaWiki:Abusefilter-log-search-filter]]
	'afrt-filter': 'ID do filtro (desativa as opções acima)',
	// [[MediaWiki:Abusefilter-log-detailslink]]
	'afrt-details': 'detalhes',
	// [[MediaWiki:Abusefilter-changeslist-examine]]
	'afrt-examine': 'examinar',
	// [[MediaWiki:Diff]]
	'afrt-diff': 'dif',
	// [[MediaWiki:Hist]]
	'afrt-hist': 'hist',
	// [[MediaWiki:Talkpagelinktext]]
	'afrt-talkpage': 'discussão',
	// [[MediaWiki:Contribslink]]
	'afrt-contribs': 'contribs',
	'afrt-filter-logs': 'registros dos filtros',
	'afrt-filter-logs-title': 'Registro do filtro de edições para este usuário',
	'afrt-load-more': 'Carregar mais',
	'afrt-error-badsyntax' : 'Erro de sintaxe',
	'afrt-error-permissiondenied' : 'Permissão negada',
	'afrt-error-nosuchlogid' : 'Não foi encontrado o registro $1.'
} );

var batchSize = 100,
	api;

function finish(){
	$.removeSpinner( 'afrt-spinner' );
	$( 'input[type="submit"]' ).prop( 'disabled', false );
}

function getListItem( log ){
	return $( '<li>' )
		.attr( 'id', 'log-' + log.id )
		.append(
		// '&lt;image&gt;',
		log.timestamp,
		' (',
		$( '<a>' )
			.attr( {
				href: mw.util.getUrl( 'Special:AbuseLog/' + log.id ),
				title: 'Special:AbuseLog/' + log.id
			} )
			.text( mw.msg( 'afrt-details' ) ),
		' | ',
		$( '<a>' )
			.attr( {
				href: mw.util.getUrl(
					'Special:AbuseFilter/examine/log/' + log.id, {
						testfilter: $( '#wpTestFilter' ).val()
					}
				),
				title: 'Special:AbuseFilter/examine/log/' + log.id
			} )
			.text( mw.msg( 'afrt-examine' ) ),
		'): ',
		$( '<a>' )
			.attr( {
				href: mw.util.getUrl( log.title ),
				title: log.title
			} )
			.text( log.title ),
		' (',
		// mw.msg( 'afrt-diff' ),
		// ' | ',
		$( '<a>' )
			.attr( {
				href: mw.util.getUrl( log.title ) + '?action=history',
				title: log.title
			} )
			.text( mw.msg( 'afrt-hist' ) ),
		') ',
		'<span class="mw-changeslist-separator">. .</span>',
		' ',
		$( '<a>' )
			.attr( {
				href: mw.util.getUrl( 'User:' + log.user ),
				title: 'User:' + log.user
			} )
			.addClass( 'mw-userlink' )
			.text( log.user ),
		' (',
		$( '<a>' )
			.attr( {
				href: mw.util.getUrl( 'User talk:' + log.user ),
				title: 'User talk:' + log.user
			} )
			.text( mw.msg( 'afrt-talkpage' ) ),
		' | ',
		$( '<a>' )
			.attr( {
				href: mw.util.getUrl( 'Special:Contribs/' + log.user ),
				title: 'Special:Contribs/' + log.user
			} )
			.text( mw.msg( 'afrt-contribs' ) ),
		' | ',
		$( '<a>' )
			.attr( {
				href: mw.util.getUrl( 'Special:AbuseLog', { wpSearchUser: log.user } ),
				title: mw.msg( 'afrt-filter-logs-title' )
			} )
			.text( mw.msg( 'afrt-filter-logs' ) ),
		')'
		//, '<br />', JSON.stringify( log )
	);
}

// Inspired by
// https://github.com/wikimedia/mediawiki-extensions-AbuseFilter/blob/master/modules/ext.abuseFilter.examine.js

function showLogs( logs ){
	var i, $ol,
		logDeferred = $.Deferred(),
		filterCode = $( '#wpTestFilter' ).val(),
		current = 0;

	$ol = $( '#log-list' );
	for( i = 0; i < logs.length; i++ ){
		getListItem( logs[i] ).appendTo( $ol );
	}

	function processLog( log ){
		// Use post due to the rather large amount of data
		api.post( {
			action: 'abusefiltercheckmatch',
			filter: filterCode,
			logid: log.id
		} )
		.done( function( data ){
			var exClass;
			if ( data.abusefiltercheckmatch.result ) {
				exClass = 'mw-abusefilter-changeslist-match';
			} else {
				exClass = 'mw-abusefilter-changeslist-nomatch';
			}
			$( '#log-' + logs[ current ].id )
				.attr( 'class', exClass );
			current++;
			if( current < logs.length ){
				processLog( logs[ current ] );
			} else {
				logDeferred.resolve();
			}
		} )
		.fail( function( error ) {
			if ( $.inArray(error, ['badsyntax' , 'permissiondenied' ]) !== -1) {
				$( '#mw-content-text' ).append(
					$( '<p>' ).text( mw.msg( 'afrt-error-' + error ) )
				);
				logDeferred.reject( error );
			} else {
				$( '<li>' )
					.text( mw.msg( 'afrt-error-' + error, log ) )
					.appendTo( $ol );
				current++;
				if( current < logs.length ){
					processLog( logs[ current ] );
				}
			}
		} );
	}

	current = 0;
	processLog( logs[ current ] );
	return logDeferred
		.promise()
		.fail( finish );
}

function getPreviousLogs( filter ){
	var param, getLogBatch, qContinue;

	getLogBatch = function( queryContinue ){
		if( queryContinue ){
			$.extend( param, queryContinue );
		}
		api.get( param )
		.done( function ( data ) {
			showLogs( data.query.abuselog )
			.done( function () {
				var $button = $( '#afrt-load-more' );
				qContinue = data[ 'query-continue' ];
				if( qContinue ){
					if ( $button.length ) {
						$button.show();
					} else {
						$( '#log-list' ).after(
							$( '<input type="button" value="Load" id="afrt-load-more">' )
								.val( mw.msg( 'afrt-load-more' ) )
								.click( function(){
									$( '#mw-content-text' ).injectSpinner( 'afrt-spinner' );
									getLogBatch( qContinue.abuselog );
								} )
						);
					}
				} else {
					$button.hide();
				}
				finish();
			} );
		} )
		.fail( finish );
	};
	/*mw.notify(
		mw.msg( 'afs-getting-logs' ),
		{
			tag: 'stats',
			title: mw.msg( 'afs-getting-data' )
		}
	);*/
	param = {
		list: 'abuselog',
		aflfilter: filter,
		afllimit: batchSize,
		aflprop: 'ids|filter|user|title|action|result|timestamp|hidden|revid'
	};
	api = new mw.Api();
	getLogBatch();
}
	
function modifyInterface(){
	var $input = $( '<input id="afrt-filter-id" size="45">' );
	$input.change( function(){
		var inputs = '[name="wpTestUser"], [name="wpTestPeriodStart"], [name="wpTestPeriodEnd"], [name="wpTestPage"]';
		$( inputs ).prop( 'disabled', $.trim( $( this ).val() ) !== '' );
	} );
	$( '#mw-abusefilter-test-page' ).after(
		$( '<tr id="afrt-filter">' )
			.append(
				$( '<td class="mw-label">' )
					.text( mw.msg( 'afrt-filter' ) ),
				$( '<td class="mw-input">' )
					.append( $input )
			)
	);
	$( 'input[type="submit"]' ).click( function( e ){
		var id = $.trim( $( '#afrt-filter-id' ).val() );
		if ( id ){
			e.preventDefault();
			$( this ).prop( 'disabled', true );
			$( 'fieldset' ).last()
				.nextAll().remove().end()
				.after( '<ol id="log-list">' );
			$( '#mw-content-text' ).injectSpinner( 'afrt-spinner' );
			getPreviousLogs( id );
		}
	} );
}

if ( mw.config.get( 'wgCanonicalSpecialPageName' ) === 'AbuseFilter'
	&& /\/test(?:\/\d+)?$/.test( mw.config.get( 'wgTitle' ) )
) {
	mw.loader.using( [
			'mediawiki.api',
			'mediawiki.util',
			'jquery.mwExtension',
			'jquery.spinner'
		], function(){
			$( modifyInterface );
		}
	);
}

}( mediaWiki, jQuery ) );