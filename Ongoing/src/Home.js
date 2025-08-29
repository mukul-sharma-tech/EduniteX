import React, { Component } from "react";
import { Input, Button } from "@mui/material";
import "./Home.css";

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      url: "",
    };
  }

  handleChange = (e) => this.setState({ url: e.target.value });

  join = () => {
    if (this.state.url !== "") {
      var url = this.state.url.split("/");
      window.location.href = `/${url[url.length - 1]}`;
    } else {
      var url = Math.random().toString(36).substring(2, 7);
      console.log("Generated URL:", url);
      window.location.href = `/${url}`;
    }
  };

  render() {
    return (
      <>
        <div>
          <h1 style={{ fontSize: "45px" }}>EduniteX Meeting</h1>
          <p style={{ fontWeight: "200" }}>
            Enter the meeting URL given by your teacher or create a new link if
            you are a teacher
          </p>
        </div>

        <div
          style={{
            background: "white",
            width: "30%",
            height: "auto",
            padding: "20px",
            minWidth: "400px",
            textAlign: "center",
            margin: "auto",
            marginTop: "100px",
          }}
        >
          <p style={{ margin: 0, fontWeight: "bold", paddingRight: "50px" }}>
            Start or join a meeting
          </p>
          <Input placeholder="URL" onChange={(e) => this.handleChange(e)} />
          <Button
            variant="contained"
            color="primary"
            onClick={this.join}
            style={{ margin: "20px" }}
          >
            Go
          </Button>
        </div>
      </>
    );
  }
}

export default Home;
