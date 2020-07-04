// Event handling
$(document).ready(function(){
    $.get("https://api.thingspeak.com/channels/1093334/feeds/last.json", 
      function(data, status){
      alert("Connection Status: " + status);
      var message = "LAST UPDATED AT : " + data.created_at + 
                    " CYLINDER LEVEL : " + data.field1 + "%";
      $('#content').html("<h2>" + message + "</h2>" );
      if ( data.field1<10 ){
        alert("Your GAS level is low..")
      }
  });
});