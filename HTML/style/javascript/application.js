var onPageReady = function(){
	$.get('allInternDetails',function(data){
		var status = JSON.parse(data);
		updatePassingPanel(status);
	});
}

$(document).ready(onPageReady);