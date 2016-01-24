if (Meteor.isClient) {

	metaParse = function (params, callback) {
		Meteor.call('metaParse', params, callback);
	};

	Session.set('parse-result', '');
	Session.set('basic-example', false);
	Template.content.helpers({
		result : function(user_id){
			return Session.get('parse-result');
		}
	});

	Template.content.events({
		'click .js-start-parse' : function(e){
			$(e.currentTarget).attr('disabled', 'disabled').text('Wait');
			var params	= {};
			
			// basic tags
			var a 		= $('#tag_a:checked').val();
			var img 	= $('#tag_img:checked').val();
			var title 	= $('#tag_title:checked').val();
			if(typeof a != "undefined") params.a = true;
			if(typeof img != "undefined") params.img = true;
			if(typeof title != "undefined") params.title = true;
			
			// meta tags
			var meta = [];
			$("#tag_meta option:selected").each(function(){
				meta.push($( this ).text());
			});
			params.meta = (meta.length > 0)? meta : false;
			
			// url
			params.url		= $('#url').val();
			
			if(Session.get('basic-example')){
				params.meta = ['description', 'keywords', 'og:image', 'twitter:image', 'og:title', 'twitter:title'];
			}
			
			// start parse
			metaParse(params, (err, res) => {
				$(e.currentTarget).removeAttr('disabled').text('Start');
				if(err){
					Session.set('parse-result', JSON.stringify(err, null, '  '));
				}else{
					if(Session.get('basic-example')){
						// basic image
						res.image 		= (typeof res['meta']['og:image'] != "undefined")? res['meta']['og:image'] :
							(typeof res['meta']['twitter:image'] != "undefined")? res['meta']['twitter:image'] : '';
							
						// basic description
						res.description = (typeof res['meta']['description'] != "undefined")? res['meta']['description'] : '';
						
						// basic keywords
						res.keywords 	= (typeof res['meta']['keywords'] != "undefined")? res['meta']['keywords'] : '';
						delete res.meta;
					}
					Session.set('parse-result', JSON.stringify(res, null, '  '));
				}
			});
		},
		'click .js-reset' : function(e){
			Session.set('parse-result', '');
			$("input").prop('checked', false).val('');
			$("select :selected").prop('selected', false);
			$('.js-code').removeClass('show');
		},
		// basic example
		'click #basic_example' : function(e){
			if($(e.currentTarget.checked).length > 0){
				$("input").prop('checked', false).val('');
				$("#basic_example").prop('checked', true);
				$("select :selected").prop('selected', false);
				Session.set('parse-result', '');
				$('.js-code').addClass('show');
				$('#tag_title').attr('checked', 'checked');
				$('#tag_meta option').each(function(){
					if($(this).text() == 'og' || $(this).text() == 'twitter')
						$(this).attr('selected', 'selected');
				});
				$('#url').val('http://www.amazon.com');
				Session.set('basic-example', true);
			}else{
				$('.js-code').removeClass('show');
				$('#tag_title').removeAttr('checked');
				$("select :selected").prop('selected', false);
				$('#url').val('');
				Session.set('basic-example', false);
			}
		}
	});
}

if (Meteor.isServer) {
	
	metaParse = function(params){
		var html;
		var res 	= {};
		var errors 	= [];
		res.url 	=  params.url;
		
		if(params.url.substr(0, 4) === 'http'){
			try{
				var result = HTTP.call('GET', params.url, {params: {'vary': 'Accept-Encoding'}});
				if(result.statusCode !== 200){
					errors.push('Something wrong. Status code: '+result.statusCode);
				}
				html = result.content;
			}catch(e){
				errors.push(JSON.stringify(e, null, '  '));
			}
		}else{
			errors.push('Invalid url');
		}

		if(errors.length > 0){
			res.error = errors.join(', ');
		}else{
			// title
			if(params.title){
				re = /<title>(.*)<\/title>/gmi;
				if ((m = re.exec(html)) !== null) {
					res.title =  m[1];
				}
			}
			
			//meta tags
			if(params.meta != false){
				var re 	= /<meta.*(?:name|property)=['"](.*?)['"].*?(?:content|value)=['"]([\s\S]*?)['"].*>/gmi;
				var prepare = {};
				var desc;
				while((m = re.exec(html)) !== null){
					if(params.meta.indexOf(m[1]) > -1){
						var search = m[1];
					}else{
						var sep = m[1].indexOf(':');
						search 	= (sep != -1)? m[1].substr(0, sep) : m[1]
					}
					if(params.meta.indexOf(search) > -1){
						if(params.meta.indexOf(m[1]) > -1){
							prepare[search] = m[2];
						}else{
							if(sep != -1){
									desc = m[1].split(':');
									prepare[search+':'+desc[1]] = m[2];
							}else{
								prepare[search] = m[2];
							}
						}
					}
				}
				res.meta = prepare;
			}
			
			// links
			if(params.a){
				var tag_a = [];
				var re = /<a.+?\s*href\s*=\s*["\']?([^"\'\s>]+)["\']?/gmi;
				while ((m = re.exec(html)) !== null) {
					tag_a.push(m[1]);
				}
				res.a = {
					'count' : tag_a.length,
					'data'	: tag_a
				}
			}

			// images
			if(params.img){
				var tag_img = [];
				var re = /<img.+?\s*src\s*=\s*["\']?([^"\'\s>]+)["\']?/gmi;
				while ((m = re.exec(html)) !== null) {
					tag_img.push(m[1]);
				}
				res.img = {
					'count' : tag_img.length,
					'data'	: tag_img
				}
			}
		}
		return res;
	};

	Meteor.methods({
		metaParse: function (params){
			return metaParse(params);
		}
	});
}