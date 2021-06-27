// Event handling
$(document).ready(function(){
    $.get("https://api.thingspeak.com/channels/1093334/feeds.json?api_key=ZMT92WIXYMYJP6AW&results=1", 
      function(data, status){
      alert("Connection Status: " + status);
      console.log(data);
      var message = "LAST UPDATED AT : " + data.feeds[0].created_at + 
                    " CYLINDER LEVEL : " + data.feeds[0].field1 + "%";
      $('#content').html("<h2>" + message + "</h2>" );
      if ( data.feeds[0].field1<10 ){
        alert("Your GAS level is low..")
      }
  });
});