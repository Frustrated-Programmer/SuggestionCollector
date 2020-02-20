
function readTextFile(file, callback) {
    var rawFile = new XMLHttpRequest();
    rawFile.overrideMimeType("application/json");
    rawFile.open("GET", file, true);
    rawFile.onreadystatechange = function() {
        if (rawFile.readyState === 4 && rawFile.status == "200") {
            callback(rawFile.responseText);
        }
    };
    rawFile.send(null);
}
let sortedDestination;
let url = window.location.origin;
readTextFile("./sortedDestinations.json", function(text){
    sortedDestination = JSON.parse(text);

    let selector = document.getElementById("selector");
    let keys = Object.keys(sortedDestination);
    let possibleOptions = [];

    for(let i =0;i<keys.length;i++){
        if(sortedDestination[keys[i]]){
            possibleOptions.push(keys[i]);
            let option = document.createElement('option');
            if(window.location.pathname.includes(sortedDestination[keys[i]])) {
                option.selected = "selected";
                selector.selectedIndex = i;
                selector.value = keys[i];
                url +=  window.location.pathname.substring(0,(window.location.pathname.length - sortedDestination[keys[i]].length));
            }
            option.value = keys[i];
            let split = keys[i].split(/(?=[A-Z])/);
            for(let j=0;j<split.length;j++){
                split[j] = split[j][0].toUpperCase() + split[j].substring(1,split[j].length);
            }
            option.innerText = split.join(" ");
            selector.appendChild(option);
        }
    }
});
selector.onchange = function(){
    window.location = url + sortedDestination[this.value];
};



