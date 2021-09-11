<script src="js/jquery.js"></script>
<script src="js/socket.io.js"></script>

<form onsubmit="return enterName();">
  <input id="name" placeholder="Enter name">
  <input type="sibnmit">
</form>

<script>

  var io = io("http://localhost:5500");

  function enterNama() {
    //사용자 이름을 얻고
    var name = document.getElementById("name").value;

    //서버로 보냄
    io.emit("user_connected", name);

    return false;
  }

  io.on("user_connected", function (username) {
    console.log(username);
  })
</script>