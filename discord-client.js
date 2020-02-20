/**CONST**/
const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const sortedDestination = require("./sortedDestinations.json");
const fs = require("fs");
const baseHTML = fs.readFileSync("./base.html").toString();
let channel = false;
let sorted = {
    "mostVotes": [],
    "leastVotes": [],
    "mostPositiveVotes": [],
    "mostNegativeVotes": [],
    "mostLiked": [],
    "mostDisliked": [],
    "mostVotedTies": []
};

async function sort(message, type){
    let upVotes = message.reactions.find(function(reaction){
        return reaction.emoji.id === config.upVoteEmoji;
    }).count - 1 || 0;
    let downVotes = message.reactions.find(function(reaction){
        return reaction.emoji.id === config.downVoteEmoji;
    }).count - 1 || 0;
    let total = upVotes + downVotes;
    let pushed = false;
    let upVotePercent = ((upVotes / total) * 100);
    let targetIndex = sorted[type].length > 0 ? sorted[type].length-1: 0;
    let modified = false;


    function push(index){
        sorted[type].splice(index, 0, {upVotes, downVotes, id: message.id});
        pushed = true;
    }

    if(config.maxSuggestionsPerPage > 0 && sorted[type].length >= config.maxSuggestionsPerPage) return;
    for(let i = sorted[type].length-1; i >= 0; i--){
        if(pushed) break;
        let upVotePercent2 = ((sorted[type][i].upVotes / (sorted[type][i].upVotes + sorted[type][i].downVotes)) * 100);
        let upVotePercent3 = ((sorted[type][targetIndex].upVotes / (sorted[type][targetIndex].upVotes + sorted[type][targetIndex].downVotes)) * 100);
        switch(type){
            case "mostPositiveVotes":
                if(upVotes > sorted[type][i].upVotes && upVotes > sorted[type][targetIndex].upVotes) {
                    targetIndex = i;
                    modified = true;
                }
                break;
            case "mostNegativeVotes":
                if(downVotes > sorted[type][i].downVotes && downVotes > sorted[type][targetIndex].downVotes) {
                    targetIndex = i;
                    modified = true;
                }
                break;
            case "mostVotes":
                console.log(total,sorted[type][i].downVotes + sorted[type][i].upVotes,sorted[type][targetIndex].downVotes + sorted[type][targetIndex].upVotes, upVotes, sorted[type][i].upVotes,sorted[type][targetIndex].upVotes);
                if(total >= sorted[type][i].downVotes + sorted[type][i].upVotes && total >= sorted[type][targetIndex].downVotes + sorted[type][targetIndex].upVotes && upVotes > sorted[type][i].upVotes && upVotes > sorted[type][targetIndex].upVotes) {
                    console.log(i);
                    targetIndex = i;
                    modified = true;
                }
                break;
            case "leastVotes":
                if(total < sorted[type][i].downVotes + sorted[type][i].upVotes && total < sorted[type][targetIndex].downVotes + sorted[type][targetIndex].upVotes) {
                    targetIndex = i;
                    modified = true;
                }
                break;
            case "mostLiked":
                if(upVotePercent >= upVotePercent2 && upVotePercent >= upVotePercent3 && upVotes > sorted[type][i].upVotes && upVotes > sorted[type][targetIndex].upVotes)  {
                    targetIndex = i;
                    modified = true;
                }
                break;
            case "mostDisliked":
                if(upVotePercent <= upVotePercent2 && upVotePercent <= upVotePercent3 && downVotes > sorted[type][i].downVotes && downVotes > sorted[type][targetIndex].downVotes) {
                    targetIndex = i;
                    modified = true;
                }
                break;
            case "mostVotedTies":{
                let isTie = upVotes > downVotes ? upVotes - (total / config.tieGracePercent) < downVotes : downVotes - (total / config.tieGracePercent) < upVotes;
                if(isTie && total > sorted[type][i].upVotes + sorted[type][i].downVotes && total > sorted[type][targetIndex].upVotes + sorted[type][targetIndex].downVotes)  {
                    targetIndex = i;
                    modified = true;
                }
            }
                break;
            default:
                push(i);
                break;
        }
    }
    if(!pushed && modified) push(targetIndex);
    else if(!pushed && !modified) push(sorted[type].length);

}

async function checkMessages(){
    return new Promise(function(cb, err){

        if(!config.channel) throw Error("No channel id found. Please place the channel's id in the config file.");
        channel = client.channels.get(config.channel);
        if(!channel){
            if(config.debug) console.error("Couldn't fetch channel. Possible problems:\n1. Client doesn't have read/access to channel\n2. Channel's id is wrong.");
            return;
        }
        if(channel.type === "dm" || channel.type === "text" || channel.type === "news" || channel.type === "store"){
            channel.fetchMessages().then(function(msgs){
                msgs = msgs.filter(function(msg){
                    return msg.author.bot;
                });
                let arr = msgs.array();
                let keys = Object.keys(sorted);

                function quickSort(item, index){
                    return new Promise(function(cb){
                        if(!keys[index]){
                            cb();
                            return;
                        }
                        if(config.debug) console.log(`Sorting ${keys[index]}`);
                        if(sortedDestination[keys[index]]){
                            sort(item, keys[index]).then(function(){
                                quickSort(item, index + 1).then(cb);
                            });
                        } else quickSort(item, index + 1).then(cb);
                    });
                }

                function mainSort(index){
                    if(config.debug) console.log(`[------ Sorting Message #${index + 1} -----]`);
                    quickSort(arr[index], 0).then(function(){
                        if(index + 1 === arr.length) cb();
                        else mainSort(index + 1);
                    });
                }

                mainSort(0);
            });
        } else if(config.debug) console.error(`Un-supported channel type: [ ${channel.type} ]`);
    });
}

function createHTML(){
    let top = baseHTML.split("<!-- Divider -->")[0];
    let bottom = baseHTML.split("<!-- Divider -->")[1];
    let baseLink = `https://discordapp.com/channels/${channel.guild.id}/${channel.id}/`;

    function fileMaking(j){
        let keys = Object.keys(sorted);
        let index = keys[j];
        let file = top;

        function createRow(i){
            if(sortedDestination[index]){
                if(sorted[index][i]){
                    channel.fetchMessage(sorted[index][i].id).then(function(msg){
                        file += `\n<tr>\n<td class="col1">${msg.embeds[0].title.substring("Suggestion from ".length).split(" (")[0]}<br><a href="${baseLink}${msg.id}">link to suggestion</a></td>\n<td class="col2">${sorted[index][i].upVotes}<img src="./UpVote.png"></td>\n<td class="col3">${sorted[index][i].downVotes}<img src="./DownVote.png"></td>\n<td class="col4">${msg.embeds[0].description}</td>\n</tr>`;
                        createRow(i + 1);
                    });
                } else{
                    file += bottom;
                    fs.writeFile(`./${sortedDestination[index]}`, file, function(){
                        fileMaking(j + 1);
                    });
                }
            } else fileMaking(j + 1);
        }

        if(sorted[index] !== undefined  && sorted[index] != false){
            if(config.debug && sortedDestination[index]) console.log(`Creating HTML file for ${index}`);
            createRow(0);
        }
        else if(sorted[index] !== undefined) fileMaking(j + 1);
    }
    fileMaking(0);
}

client.on("ready", function(){
    if(config.debug) console.log(`Bot's ready`);
    function update (){
        checkMessages().then(function(){
            if(config.debug) console.log(`\n\n{\n    mostVotes: ${sorted.mostVotes.length} messages sorted,\n    leastVotes: ${sorted.leastVotes.length} messages sorted.\n    mostPositiveVotes: ${sorted.mostPositiveVotes.length} messages sorted,\n    mostNegativeVotes: ${sorted.mostNegativeVotes.length} messages sorted,\n    mostLiked: ${sorted.mostLiked.length} messages sorted,\n    mostDisliked: ${sorted.mostDisliked.length} messages sorted,\n    mostVotedTies: ${sorted.mostVotedTies.length} messages sorted\n}`);
            createHTML();
        }).catch(console.error);
    }
    if(!(config.updateHours === false || config.updateHours === "false") && config.updateHours != undefined){
        setTimeout(update,3600000 * parseFloat(config.updateHours));
    }
    update();
});
client.on("message", function(message){
    let isOwner = false;
    for(let i =0;i<config.ownerIDs.length;i++){
        if(message.id === config.ownerIDs[i]) isOwner = true;
    }
    if(!isOwner) return;

    if(message.content === config.stopCmd){
        message.author.send('Stopping...').then(function(){
            process.exit();
        })
    }
    if(message.content === ">stopSuggestionBotNow"){
        process.exit();
    }
});
client.login(config.token);
