function init() {
    window.addEventListener('scroll', function(e){
        var distanceY = window.pageYOffset || document.documentElement.scrollTop,
            shrinkOn = 100,
            header = document.getElementsByClassName('header');
        if (distanceY > shrinkOn) {
            if ($(".header").hasClass("big-header")){
                $(".header").removeClass("big-header");
            }
            $(".header").addClass("small-header");
        } else {
            if ($(".header").hasClass("small-header")) {
                $(".header").removeClass("small-header");
                $(".header").addClass("big-header");
            }
        }
        $("body").load(function(){
            $(".header").removeClass("small-header");
        });
    });

}
window.onload = init();
