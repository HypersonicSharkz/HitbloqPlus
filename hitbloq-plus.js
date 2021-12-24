// ==UserScript==
// @name         HitbloqPlus
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://hitbloq.com/*
// @icon         https://www.google.com/s2/favicons?domain=hitbloq.com
// @updateURL    https://github.com/motzel/scoresaber-unranked-acc/raw/master/scoresaber-unranked-acc.user.js
// @downloadURL  https://github.com/motzel/scoresaber-unranked-acc/raw/master/scoresaber-unranked-acc.user.js
// @supportURL   https://github.com/motzel/scoresaber-unranked-acc/issues
// @grant        GM_getValue
// @grant        GM_setValue
// @require      http://code.jquery.com/jquery-latest.js
// @require      https://userscripts-mirror.org/scripts/source/107941.user.js
// @run-at       document-idle
// ==/UserScript==




var href = $(location).attr('href');
var url = new URL(href);
var path = href.split('/');
var pool_id = path[path.length - 1].split('?')[0];

var pool_maps = [];
var played_pool_maps = GM_SuperValue.get("hbplus_user_scores", {});
var favorite_pools = GM_SuperValue.get("hbplus_favorite_pools", []);
var last_score_time = 0;

var savedUserID = GM_SuperValue.get("hbplus_saved_userid", -1);
var userID = -1;



var page = 0;

var gotScores = false;
var gotMaps = false;

var menuOpen = false;
function createMenu() {
    var baseCSS  = {
        "background"  : "rgb(14, 10, 27)",
        "top"         : "0px",
        "z-index"     : "1000",
        "position"    : "fixed",
        "padding"     : "5px 50px 50px 50px",
    };

    var base = $('<div/>').attr('id','menuBase').css(baseCSS);
    var menu = $('<ul style="list-style-type: none; width:500px"/>').attr('id','manuList');

    menu.append('<li class="menuItem"><button style="float:right" id="closeMenu">X</button></li>')


    var clearCache = $('<li class="menuItem"><button style="float:left" id="menuClearCache">Clear Cache</button></li>');
    menu.append('<li class="menuItem"><p style="float:left">SavedUserID:</p><p style="float:right; background=black">'+savedUserID+'</p></li>');

    var poolMaps = 0;

    for (const [key, value] of Object.entries(played_pool_maps)) {
        poolMaps += Object.keys(value).length;
    }

    menu.append('<li class="menuItem"><p style="float:left">SavedPoolScores:</p><p style="float:right; background=black">'+poolMaps+'</p></li>');


    menu.append(clearCache);
    base.append(menu);
    $('body').append(base);
    menuOpen = true;

    $("#closeMenu").click(function() {$( "#menuBase" ).remove(); menuOpen=false;} )

    $("#menuClearCache").click(function() { if(confirm("Are you sure you want to clear the cache?")) { GM_SuperValue.set("hbplus_user_scores", {});
                                            GM_SuperValue.set("hbplus_favorite_pools", []);
                                            GM_SuperValue.set("hbplus_saved_userid", -1); }
                                          })

    $(".menuItem").css({
        "width":"100%",
        "height": "30px",
        "line-height": "30px",
        "display": "inline-block"
    });
}

function OpenSettingsMenu() {
    if (!menuOpen)
        createMenu();
}

$(".navbar-options").append('<a href="javascript:void(0);" class="navbar-link link fas fa-cog" id="hbplus_settings"></a>');
$("#hbplus_settings").click(function() { OpenSettingsMenu() });


function removeDuplicateScores() {
    var new_d = [];
    for (const song of played_pool_maps[""+pool_id+""]) {
        if (!new_d.some((x) => x["song_id"] == song["song_id"])) {
            new_d.push(song);
        }
    }
    played_pool_maps[""+pool_id+""] = new_d;
}

function removeUnrankedMaps(rankedMaps) {
    played_pool_maps[""+pool_id+""] = played_pool_maps[""+pool_id+""].filter(function(map) { return rankedMaps.some((x) => x["song_id"] == map["song_id"]) })
}

var userScores = [];
function getUserScores(p_userID, checkID = true, first = true) {
    if (p_userID == savedUserID && checkID === true) {
        if (!played_pool_maps[""+pool_id+""]) { played_pool_maps[""+pool_id+""] = []; };

        console.log("gettingScores");
        fetch("https://hitbloq.com/api/user/"+p_userID+"/scores?pool="+pool_id+"&page="+page+"&sort=newest")
            .then(response => response.json())
            .then(data => {
            played_pool_maps[""+pool_id+""].push.apply(played_pool_maps[""+pool_id+""], data.filter((x)=> {return x["time"] > last_score_time}) );
            if (data.length >= 10 && data.every((m) => m["time"] > last_score_time)) {
                page++;
                getUserScores(p_userID);
            } else {
                console.log(played_pool_maps);
                last_score_time = played_pool_maps[""+pool_id+""][0]["time"];
                removeDuplicateScores();
                removeUnrankedMaps(pool_maps);
                GM_SuperValue.set("hbplus_user_scores", played_pool_maps);;
                userScores = played_pool_maps[""+pool_id+""];
                gotScores=true;
            }
        });
    } else {
        if (first) {userScores = []; page=0; gotScores=false;}
        //Not the users profile
        fetch("https://hitbloq.com/api/user/"+p_userID+"/scores?pool="+pool_id+"&page="+page+"&sort=newest")
            .then(response => response.json())
            .then(data => {
            userScores.push.apply(userScores, data)
            if (data.length >= 10) {
                page++;
                getUserScores(p_userID, checkID, false);
            } else {
                console.log(userScores);
                gotScores=true;
            }
        });
    }

}

function getMapJson() {
    console.log("Loop");
    fetch("https://hitbloq.com/api/ranked_list_detailed/"+pool_id+"/"+page+"?per_page=100")
        .then(response => response.json())
        .then(data => {
            pool_maps.push.apply(pool_maps, data);
            if (data.length == 0) {return };
            if (data.length >= 100) {
                page++;
                getMapJson();
            } else {
                console.log(pool_maps);
                gotMaps=true;
            }
        });
}

function removeAllChildNodes(parent) {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}

function exec(fn) {
    var script = document.createElement('script');
    script.setAttribute("type", "application/javascript");
    script.textContent = '(' + fn + ')();';
    document.body.appendChild(script); // run the script
    document.body.removeChild(script); // clean up
}

function updateList(maps) {
    removeAllChildNodes(document.getElementById('ranked-list-entries-container'));
    for (const song of maps.slice(0,30)) {
        //console.log(song);
        var newHTML = useTemplate('new_ranked_list_entry',
            {
                'name': '<a class="link" href="/leaderboard/' + song['song_id'] + '?pool=' + pool_id + '">' + song['song_name'] + '</a>',
                'cover': song['song_cover'],
                'difficulty': song['song_difficulty'],
                'play_count': song['song_plays'],
                'stars': song['song_stars'] + '★',
            });

        //console.log(newHTML);

    document.getElementById('ranked-list-entries-container').appendChild(newHTML);
  }
}

function updateScores(maps,page) {
    removeAllChildNodes(document.getElementById('player-profile-scores'));
    for (const score of maps.slice(page*10,(page + 1) * 10)) {
        var newHTML = useTemplate('new_player_profile_score',
                                  {
            'cover': score['song_cover'],
            'rank': "",
            'name': '<a href="/leaderboard/' + score['song_id'] + '?pool=' + pool_id + '" class="link">' + score['song_name'] + '</a>',
            'difficulty': score['song_difficulty'],
            'date': score['song_stars'] + '★',
            'raw_cr': "",
            'weighted_cr': "",
            'accuracy': "",
        });

        document.getElementById('player-profile-scores').appendChild(newHTML);
    }
}





if (href.includes("/ladder/")) {
    console.log(pool_id);
    $(".player-search-section").prepend('<div class="pool_button">');
    $(".pool_button").append('<a class="fas fa-list fa-2x icon-hbplus" href="https://hitbloq.com/ranked_list/'+pool_id+'" id="rankedList">');
    $(".pool_button").css({"margin":"10 10","float":"left","width":"100%"});

    if (savedUserID != -1)
        $(".player-search-section").append('<a class="fas fa-user-circle fa-2x icon-hbplus" id="goto_user_profile" href="https://hitbloq.com/user/'+savedUserID+'?pool='+pool_id+'" title="Go to profile">');
}

if (href.includes("/ranked_list/")) {
    //start by getting all maps in a list
    getMapJson();


    $("#ranked-list-container").prepend('<div class="pool-search-section card popup-element">');
    $(".pool-search-section").css({"display":"flex","justify-content":"right"});
    $(".pool-search-section").append('<input id="pool-search" class="simple-input" type="text" placeholder="Search Map" name="input" autocomplete="off">');
    $("#pool-search").css({"margin":"0 0.3em 2em 0"});
    $('#pool-search').keyup(function(e){
        var str = $('#pool-search').val().toLowerCase();
        var filteredMaps = pool_maps.filter((x)=>{
            return x["song_name"].toLowerCase().includes(str)
        })
        updateList(filteredMaps);
        //console.log(filteredMaps);

    });


    $(".pool-search-section").prepend('<div class="ladder_button">');
    $(".ladder_button").append('<a class="fas fa-users fa-2x icon-hbplus" href="https://hitbloq.com/ladder/'+pool_id+'" id="rankedList">');
    $(".ladder_button").css({"margin":"10 10","float":"left","width":"100%"});

    if (savedUserID != -1)
        $(".pool-search-section").append('<a class="fas fa-user-circle fa-2x icon-hbplus" id="goto_user_profile" href="https://hitbloq.com/user/'+savedUserID+'?pool='+pool_id+'" title="Go to profile">');
}


function SetUserProfile(user_id) {
    GM_SuperValue.set("hbplus_saved_userid", user_id);
}


if (href.includes("/map_pools")) {
    $(".announcement-container").after(`<h1 class="home-element" style="text-align: center; font-size: 3em;">Favorite Pools</h1>
                                       <div class="map-pools-container favorite-pools" style="margin-bottom: 20px"></div>
                                       <h1 class="home-element" style="text-align: center; font-size: 3em;">Other Pools</h1>`);

    if (savedUserID != -1) {
        $('.map-pools-container').bind('DOMNodeInserted', function(e) {

            if ($(e.target).parent(".favorite-pools").length)
                return;

            var poolLink = $(e.target).find('a').slice(0,1).attr('href');
            if (poolLink) {

                var _pool = poolLink.split("/");
                _pool = _pool[_pool.length - 1]

                $(e.target).find(".map-pool-links-right").append('<a class="fas fa-user-circle map-pool-link" href="https://hitbloq.com/user/'+savedUserID+'?pool='+_pool+'">');
                //check favorites :O

                $(e.target).find(".map-pool-links-right").append('<a class="far fa-star" href="javascript:void(0)">');
                var fav = $(e.target).find(".fa-star");

                if (favorite_pools.includes(_pool)) {

                    fav.addClass("fas").removeClass("far");

                    $(fav).click(function() {

                        favorite_pools.splice(favorite_pools.indexOf(_pool), 1);
                        GM_SuperValue.set("hbplus_favorite_pools", favorite_pools);
                        $(e.target).remove();
                    });

                    $(".favorite-pools").append($(e.target).detach());
                } else {
                    $(fav).click(function() {
                        favorite_pools.push(_pool);
                        GM_SuperValue.set("hbplus_favorite_pools", favorite_pools);
                        $(".favorite-pools").append($(e.target).detach());
                        $(fav).removeClass("far");
                        $(fav).addClass("fas");
                    });
                }

            }
        });
    }
}

function ShowNewSorting(maps, all = false) {
    removeAllChildNodes(document.getElementById('player-profile-scores'));
    for (const score of all ? maps : maps.slice(pageParam * 10, (pageParam + 1) * 10)) {
        var newHTML = useTemplate('new_player_profile_score',
                                  {
            'cover': score['song_cover'],
            'rank': score['song_rank'],
            'name': '<a href="/leaderboard/' + score['song_id'] + '?pool=' + pool_id + '" class="link">' + score['song_name'] + '</a>',
            'difficulty': score['difficulty'],
            'date': score['date_set'],
            'raw_cr': score['cr_received'],
            'weighted_cr': score['weighted_cr'],
            'accuracy': score['accuracy'],
        });

        document.getElementById('player-profile-scores').appendChild(newHTML);
    }
}

function LoadSorting() {

    var filterType = url.searchParams.get("filter") ? url.searchParams.get("filter") : "acending";
    var sortType = url.searchParams.get("sort");

    switch (sortType) {
        case "not_played":
            $("#not_played-sort-link").css("box-shadow", "rgb(255, 0, 68) 0px -2px 0px inset;");


            (async() => {
                console.log("waiting for variable");
                getMapJson();
                while(!gotMaps)
                    await new Promise(resolve => setTimeout(resolve, 1000));

                page = 0;
                getUserScores(userID);

                while(!gotScores)
                    await new Promise(resolve => setTimeout(resolve, 1000));
                //Time to compare :O
                var unplayed_maps = pool_maps.filter((x)=>{
                    return !userScores.some((song) => song["song_id"] == x["song_id"])
                })
                console.log(unplayed_maps);

                updateScores(unplayed_maps, pageParam);

                //Now time to show them poggies

            })();


            break;

        case "rank":
            $("#rank-sort-link").css("box-shadow", "rgb(255, 0, 68) 0px -2px 0px inset;")
            getMapJson();


            (async() => {
                console.log("waiting for scores");

                while(!gotMaps)
                    await new Promise(resolve => setTimeout(resolve, 1000));

                page = 0;
                getUserScores(userID);

                while(!gotScores)
                    await new Promise(resolve => setTimeout(resolve, 1000));

                //order by song rank
                var orderedScores = played_pool_maps[""+pool_id+""].sort(function(first, second) {
                    return filterType == "decending" ?  first["song_rank"] - second["song_rank"] : second["song_rank"] - first["song_rank"];
                });

                ShowNewSorting(orderedScores);
                //updateScores(orderedScores, pageParam);

            })();
            break;

        case "acc":
            $("#acc-sort-link").css("box-shadow", "rgb(255, 0, 68) 0px -2px 0px inset;")
            getMapJson();


            (async() => {
                console.log("waiting for scores");

                while(!gotMaps)
                    await new Promise(resolve => setTimeout(resolve, 1000));

                page = 0;
                getUserScores(userID);

                while(!gotScores)
                    await new Promise(resolve => setTimeout(resolve, 1000));

                //order by song rank
                var orderedScores = played_pool_maps[""+pool_id+""].sort(function(first, second) {
                    return filterType == "decending" ? second["accuracy"] - first["accuracy"] : first["accuracy"] - second["accuracy"];
                });

                ShowNewSorting(orderedScores);
                //updateScores(orderedScores, pageParam);

            })();
            break;
    }
}


function CompareScores(user1, user2) {
 (async() => {
     getUserScores(user1, false);

     while(!gotScores)
         await new Promise(resolve => setTimeout(resolve, 1000));

     var user1Scores = [...userScores];

     gotScores = false;
      getUserScores(user2, false);

     while(!gotScores)
         await new Promise(resolve => setTimeout(resolve, 1000));

     var user2Scores = [...userScores];

     console.log(user1Scores);
     console.log(user2Scores);
     var worseThanList = [];
     for (const score of user1Scores) {
         console.log(score);
         var score2 = user2Scores.find(x => x["song_id"] == score["song_id"]);
         console.log(score2);
         if (score2) {
             if (score2["song_rank"] < score["song_rank"]) {

                 score["song_rank"] = score["song_rank"] + " / " + score2["song_rank"];
                 score["accuracy"] = score["accuracy"] + " / " + score2["accuracy"];
                 score["cr_received"] = Math.round((score["cr_received"] - score2["cr_received"]) * 100) / 100;



                 worseThanList.push(score);
             }
         }
     }

     /*
     worseThanList = worseThanList.sort(function(sc1, sc2) {
         var crs1 = sc1["cr_received"].split("/");
         var crs2 = sc2["cr_received"].split("/");

         crs1[0] = parseFloat(crs1[0]);
         crs1[1] = parseFloat(crs1[1]);

         crs2[0] = parseFloat(crs2[0]);
         crs2[1] = parseFloat(crs2[1]);
         return (crs1[1] - crs1[0]) - (crs2[1] - crs2[0]);
     });*/
     worseThanList = worseThanList.sort(function(sc1, sc2) {
         return parseFloat(sc1["cr_received"]) - parseFloat(sc2["cr_received"]);
     });


     ShowNewSorting(worseThanList, true);

 })();
}


if (href.includes("/user/")) {
    var loc = href.split("?")[0];

    pool_id = url.searchParams.get('pool');
    var pageParam = url.searchParams.get('page') ? parseFloat(url.searchParams.get('page')) : 0;
    var filterType = url.searchParams.get("filter") ? url.searchParams.get("filter") : "acending";

    userID = href.split('/');
    userID = userID[userID.length - 1].split("?")[0];
    console.log(userID);

    last_score_time = played_pool_maps[""+pool_id+""] ? played_pool_maps[""+pool_id+""][0] ? played_pool_maps[""+pool_id+""][0]["time"] : 0 : 0;
    console.log(last_score_time);

    $(".player-profile-username").append('<a class="fas fa-user-circle icon-hbplus-setuser" style="color: white" id="set_user_profile" href="javascript:void(0);" title="Set as your profile">');
    $("#set_user_profile").click(function(){ SetUserProfile(userID) })


    if (savedUserID == userID){
        $(".icon-hbplus-setuser").css({"color": "green", "title": "This is your profile"});
    }

    $(".icon-hbplus-setuser").hover(function(){
        $(this).css({"color": "rgb(255, 0, 68)", "transition": "all 250ms ease-in-out"});
    }, function(){
        if (savedUserID == userID){
            $(this).css({"color": "green", "transition": "all 250ms ease-in-out"});
        }
        else
            $(this).css({"color": "white", "transition": "all 250ms ease-in-out"});
    });


    $(".player-profile-pool-stats").append('<a class="fas fa-list fa-2x map-pool-link icon-hbplus" href="https://hitbloq.com/ranked_list/'+pool_id+'" id="rankedList" style="margin: 5px 0 0 0">');
    $(".player-profile-pool-stats").append('<a class="fas fa-users fa-2x map-pool-link icon-hbplus" href="https://hitbloq.com/ladder/'+pool_id+'" id="rankedList" style="margin: 5px 10px">');


    $(".profile-score-sorts").append('<a href="'+loc+'?pool='+pool_id+'&sort=not_played" class="sort-link" id="not_played-sort-link">Unplayed</a>');
    $(".profile-score-sorts").append('<a href="'+loc+'?pool='+pool_id+'&sort=rank" class="sort-link" id="rank-sort-link">Rank</a>');
    $(".profile-score-sorts").append('<a href="'+loc+'?pool='+pool_id+'&sort=acc" class="sort-link" id="acc-sort-link">Acc</a>');


    $(".profile-score-sorts").
        append(`<select id="filter">
                    <option value="acending">Acending</option>
                    <option value="decending">Decending</option>
                </select>`)

    $('.profile-score-sorts option[value="' + filterType +'"').prop("selected", true)

    $("#filter").change(function() {
        url.searchParams.set('filter', $(this).val() );
        window.open(url.href, "_self");
    });


    $(".profile-score-sorts").append('<input placeholder="Compare UserID" class="sort-link" style="width:13%;" id="compare_input">');
    $("#compare_input").keypress(function (e) {
        if (e.which == 13) {
            CompareScores(userID, $(this).val());

            return false;    //<---- Add this line
        }
    });


    LoadSorting();


    $('#player-ranks').bind('DOMNodeInserted', function(e) {
        if ( !$(e.target).is("div") || $(e.target).find('.map-pool-link').length) {
            return;
        }

        var poolLink = $(e.target).find('a').slice(0,1).attr('href');

        if (poolLink) {
            var _pool = poolLink.split("/");
            _pool = _pool[_pool.length - 1];

            $(e.target).find(".player-rank-pool").prepend('<a class="fas fa-user-circle map-pool-link" id="goto_user_profile" href="https://hitbloq.com/user/'+userID+'?pool='+_pool+'">');
        }
    });

    //loadTemplates(['new_player_profile_score']);
}



if (href.includes("/leaderboard/")) {
    var mapID = $.trim($(".leaderboard-info-right").text());
    mapID = mapID.split('\n');

    $(".leaderboard-info-right").append('<br><a class="fas fa-exclamation" href="javascript:void(0);">');
    $(".fa-exclamation").click(function() {
        navigator.clipboard.writeText("!bsr " + mapID[0]);
    });


    $('.leaderboard-info-left').prepend('<a href="https://beatsaver.com/maps/'+mapID[0]+'" id="beatsaver-link">');
    $('#beatsaver-link').append($('.leaderboard-title').detach());
    $('#beatsaver-link').append($('.leaderboard-artist').detach());
    $('#beatsaver-link').append($('.leaderboard-mapper').detach());
}


$(".icon-hbplus").hover(function(){
    $(this).css({"color": "rgb(255, 0, 68)", "transition": "all 250ms ease-in-out"});
}, function(){
    $(this).css({"color": "inherit", "transition": "all 250ms ease-in-out"});
});



//User profile


if (savedUserID != -1) {
    console.log("User is set");
}
