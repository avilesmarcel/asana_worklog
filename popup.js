window.addEventListener('load', function() {

  // Our default error handler.
  Asana.ServerModel.onError = function(response) {
    showError(response.errors[0].message);
  };

  // Ah, the joys of asynchronous programming.
  // To initialize, we've got to gather various bits of information.
  // Starting with a reference to the window and tab that were active when
  // the popup was opened ...
  chrome.windows.getCurrent(function(w) {
    chrome.tabs.query({
      active: true,
      windowId: w.id
    }, function(tabs) {
      // Now load our options ...
      Asana.ServerModel.options(function(options) {
        // And ensure the user is logged in ...
        Asana.ServerModel.isLoggedIn(function(is_logged_in) {
          if (is_logged_in) {
            if (window.quick_add_request) {
              // If this was a QuickAdd request (set by the code popping up
              // the window in Asana.ExtensionServer), then we have all the
              // info we need and should show the add UI right away.
              showAddUi(
                  quick_add_request.url, quick_add_request.title,
                  quick_add_request.selected_text, options);
            } else {
              // Otherwise we want to get the selection from the tab that
              // was active when we were opened. So we set up a listener
              // to listen for the selection send event from the content
              // window ...
              var selection = "";
              var listener = function(request, sender, sendResponse) {
                if (request.type === "selection") {
                  chrome.extension.onRequest.removeListener(listener);
                  console.info("Asana popup got selection");
                  selection = "\n" + request.value;
                }
              };
              chrome.extension.onRequest.addListener(listener);

              // ... and then we make a request to the content window to
              // send us the selection.
              var tab = tabs[0];
              chrome.tabs.executeScript(tab.id, {
                code: "(Asana && Asana.SelectionClient) ? Asana.SelectionClient.sendSelection() : 0"
              }, function() {
                // The requests appear to be handled synchronously, so the
                // selection should have been sent by the time we get this
                // completion callback. If the timing ever changes, however,
                // that could break and we would never show the add UI.
                // So this could be made more robust.
                showAddUi(tab.url, tab.title, selection, options);
              });
            }
          } else {
            // The user is not even logged in. Prompt them to do so!
            showLogin(Asana.Options.loginUrl(options));
          }
        });
      });
    });
  });
});

// Helper to show a named view.
var showView = function(name) {
  ["login", "add", "success"].forEach(function(view_name) {
    $("#" + view_name + "_view").css("display", view_name === name ? "" : "none");
  });
};

var task_id = "";
var proj_id = "";
var wrkspace_id = "";
var dotTag_id = 0 ;
var wrkTag_id = 0 ;

// Show the add UI
var showAddUi = function(url, title, selected_text, options) {
  var self = this;
  var res = url.split("/");
  if(url.indexOf("app.asana.com") !== -1){
    proj_id = res[4];
    task_id = res[5];
    showView("add");
    //$("#task").val(res[5]);
    //$("#name").val(title);
    //$("#name").focus();
    //$("#name").select();

    Asana.ServerModel.task(task_id, function(task) {
      $("#task").val(task.name);
    });
    
    Asana.ServerModel.me(function(user) {
      $("#assignee").html("");
      $("#assignee").append(
              "<option value='" + user.id + "'>" + user.name + "</option>");
      $("#assignee").val(user.id);
    });
      
    Asana.ServerModel.tags(task_id,
      function(tags) {
        setStartEnabled(true);
        setStopEnabled(false);
        $("#tags").html("");
        tags.forEach(function(tag) {
          $("#tags").append("<option value='" + tag.id + "'>" + tag.name + "</option>");
          if (tag.name == "[working]") {
            setStartEnabled(false);
            setStopEnabled(true);
            $("#tags").val(tag.id);  
          }
        });
      }
    );  

/*
    Asana.ServerModel.projects(proj_id, function(proj) {
      wrkspace_id = proj.workspace.id;
      Asana.ServerModel.allTags(wrkspace_id,function(tags) {
        tags.forEach(function(tag){
          if(tag.name == "."){
            dotTag_id = tag.id;
          }else if(tag.name == "[working]"){
            wrkTag_id = tag.id;
          }
        });

        if (true){
          //cria tag
          Asana.ServerModel.createTag(wrkspace_id,{name:"[working]"},
            function(newTag){
              dotTag_id = newTag.id;
              alert(newTag.id);
            },function(err){
              alert("error");
            }
          );
        }


      });
    });
*/
/*
    Asana.ServerModel.me(function(user) {
      Asana.ServerModel.workspaces(function(workspaces) {
        $("#workspace").html("");
        workspaces.forEach(function(workspace) {
          $("#workspace").append(
              "<option value='" + workspace.id + "'>" + workspace.name + "</option>");
        });
        $("#workspace").val(options.default_workspace_id);
        onWorkspaceChanged();
        $("#workspace").change(onWorkspaceChanged);
      });
    }); 
*/
  } else{
    showError("Necessário selecionar uma task no asana!");
  }
};

// Enable/disable the add button.
var setAddEnabled = function(enabled) {
  var button = $("#add_button");
  if (enabled) {
    button.removeClass("disabled");
    button.addClass("enabled");
    button.click(function() {
      createTask();
      return false;
    });
    button.keydown(function(e) {
      if (e.keyCode === 13) {
        createTask();
      }
    });
  } else {
    button.removeClass("enabled");
    button.addClass("disabled");
    button.unbind('click');
    button.unbind('keydown');
  }
};

// Enable/disable the Start button.
var setStartEnabled = function(enabled) {
  var button = $("#start_button");
  if (enabled) {
    button.removeClass("disabled");
    button.addClass("enabled");
    button.click(function() {
      manageTag("[start]");
      //createStory("[start]");
      return false;
    });
    button.keydown(function(e) {
      if (e.keyCode === 13) {
        manageTag("[start]");
      }
    });
  } else {
    button.removeClass("enabled");
    button.addClass("disabled");
    button.unbind('click');
    button.unbind('keydown');
  }
};

// Enable/disable the Hold button.
var setHoldEnabled = function(enabled) {
  var button = $("#hold_button");
  if (enabled) {
    button.removeClass("disabled");
    button.addClass("enabled");
    button.click(function() {
      manageTag("[hold]");
      return false;
    });
    button.keydown(function(e) {
      if (e.keyCode === 13) {
        manageTag("[hold]");
      }
    });
  } else {
    button.removeClass("enabled");
    button.addClass("disabled");
    button.unbind('click');
    button.unbind('keydown');
  }
};

// Enable/disable the Stop button.
var setStopEnabled = function(enabled) {
  var button = $("#stop_button");
  if (enabled) {
    button.removeClass("disabled");
    button.addClass("enabled");
    button.click(function() {
      manageTag("[stop]");
      return false;
    });
    button.keydown(function(e) {
      if (e.keyCode === 13) {
        manageTag("[stop]");
      }
    });
  } else {
    button.removeClass("enabled");
    button.addClass("disabled");
    button.unbind('click');
    button.unbind('keydown');
  }
};

// Set the add button as being "working", waiting for the Asana request
// to complete.
var setAddWorking = function(working) {
  setAddEnabled(!working);
  $("#add_button").find(".button-text").text(
      working ? "Adding..." : "Add to Asana");
};

// Set the start button as being "working", waiting for the Asana request
// to complete.
var setStartWorking = function(working) {
  setStartEnabled(!working);
  $("#start_button").find(".button-text").text(
      working ? "Running..." : "Start");
};

// Set the hold button as being "working", waiting for the Asana request
// to complete.
var setHoldWorking = function(working) {
  setHoldEnabled(!working);
  $("#hold_button").find(".button-text").text(
      working ? "Continue" : "Hold");
};

// Set the stop button as being "working", waiting for the Asana request
// to complete.
var setStopWorking = function(working) {
  setStopEnabled(!working);
  $("#stop_button").find(".button-text").text(
      working ? "Stopping..." : "Stop");
};

// When the user changes the workspace, update the list of users.
var onWorkspaceChanged = function() {
  var workspace_id = readWorkspaceId();
  $("#assignee").html("<option>Loading...</option>");
  setAddEnabled(false);
  Asana.ServerModel.users(workspace_id, function(users) {
    $("#assignee").html("");
    users = users.sort(function(a, b) {
      return (a.name < b.name) ? -1 : ((a.name > b.name) ? 1 : 0);
    });
    users.forEach(function(user) {
      $("#assignee").append(
          "<option value='" + user.id + "'>" + user.name + "</option>");
    });
    Asana.ServerModel.me(function(user) {
      $("#assignee").val(user.id);
    });
    setAddEnabled(true);
  });
};

var readAssignee = function() {
  return $("#assignee").val();
};

var readWorkspaceId = function() {
  return $("#workspace").val();
};

var readTaskId = function() {
  //return $("#task").val();
  return task_id;
};

var createTask = function() {
  console.info("Creating task");
  hideError();
  setAddWorking(true);
  Asana.ServerModel.createTask(
      readWorkspaceId(),
      {
        name: $("#name").val(),
        notes: $("#notes").val(),
        assignee: readAssignee()
      },
      function(task) {
        setAddWorking(false);
        showSuccess(task);
      },
      function(response) {
        setAddWorking(false);
        showError(response.errors[0].message);
      });
};

function startTimer () {
    timer.start();
    setTimeout(stopTimer,400);
}

function stopTimer () {
    timer.stop;
}



var removeWorkingTag = function(callback, errback){
  //alert("removeWorkingTag");
  Asana.ServerModel.removeTaskTag(readTaskId(),{tag:11708685339766},callback, errback);
}
var addWorkingTag = function(callback, errback){
  //alert("addWorkingTag");
  Asana.ServerModel.addTaskTag(readTaskId(),{tag:11708685339766},callback, errback);
}
var removeDotTag = function(callback, errback){
  Asana.ServerModel.removeTaskTag(readTaskId(),{tag:11721866157856},callback, errback);
}
var addDotTag = function(callback, errback){
  Asana.ServerModel.addTaskTag(readTaskId(),{tag:11721866157856},callback, errback);
}

var removeStartTag = function(callback, errback){
  //alert("removeStartTag");
  Asana.ServerModel.removeTaskTag(readTaskId(),{tag:11708685339764},callback, errback);
}
var removeStopTag = function(callback, errback){
  //alert("removeStopTag");
  Asana.ServerModel.removeTaskTag(readTaskId(),{tag:11708685339768},callback, errback);
}
var removePausedTag = function(callback, errback){
  //alert("removePausedTag");
  Asana.ServerModel.removeTaskTag(readTaskId(),{tag:11721866157856},callback, errback);
}
var addStartTag = function(callback, errback){
  //alert("addStartTag");
  Asana.ServerModel.addTaskTag(readTaskId(),{tag:11708685339764},callback, errback);
}
var addStopTag = function(callback, errback){
  //alert("addStopTag");
  Asana.ServerModel.addTaskTag(readTaskId(),{tag:11708685339768},callback, errback);
}
var addPausedTag = function(callback, errback){
  //alert("addPausedTag");
  Asana.ServerModel.addTaskTag(readTaskId(),{tag:11721866157856},callback, errback);
}


//Marcel
var manageTag = function(button) {
  console.info("Creating tags");
  hideError();

  switch (button) {
    case "[start]":
        setStartWorking(true);
        addWorkingTag(function(response){
          addDotTag(function(response){
          setStartWorking(false);
          setStartEnabled(false);
          setStopEnabled(true);});
          },function(response) {
            manageTag("[start]");
            showError(response.errors[0].message);
          }
        );
        break;
    case "[stop]":
        setStopWorking(true);
        removeWorkingTag(function(response){
          removeDotTag(function(response){
          setStopWorking(false);
          setStopEnabled(false);
          setStartEnabled(true);});
          },function(response) {
            manageTag("[stop]");
            showError(response.errors[0].message);
          }
        );
        break;
  } 
  
};

//Marcel
var createStory = function(status) {
  console.info("Creating Story");
  hideError();

  switch (status) {
    case "[start]":
        setStartWorking(true);
        Asana.ServerModel.createStory(
            readTaskId(),
            {
              text: status
            },
            function(task) {
              setStopEnabled(true);
              setHoldEnabled(true);
              //setStartWorking(false);
              //showSuccess(task);
            },
            function(response) {
              setStartWorking(false);
              showError(response.errors[0].message);
            });
        break;
    case "[hold]":
        setHoldWorking(true);
        Asana.ServerModel.createStory(
            readTaskId(),
            {
              text: status
            },
            function(task) {
              setStartWorking(false);
              setStartEnabled(false);
              setHoldEnabled(true);
              setStopEnabled(false);
              //setStartWorking(false);
              //showSuccess(task);
            },
            function(response) {
              setHoldWorking(false);
              showError(response.errors[0].message);
            });
        break;
    case "[stop]":
        setHoldEnabled(false);
        setStopWorking(true);
        Asana.ServerModel.createStory(
            readTaskId(),
            {
              text: status
            },
            function(task) {
              setStartWorking(false);
              setHoldEnabled(false);
              setStopWorking(false);
              setStopEnabled(false);
              //showSuccess(task);
            },
            function(response) {
              setStopWorking(false);
              setStopEnabled(false);
              setStartWorking(false);
              showError(response.errors[0].message);
            });
        break;
  } 
  
};

var check4tags = function(strt1,wrk1,pse1,stp1){
  Asana.ServerModel.tags(readTaskId(),
    function(tags) {
      tags.forEach(function(tag) {
        
        switch (tag.name) {
          case "[started]":
            
            break;
          case "[working]":
            
            break;
          case "[paused]":
            
            break;
          case "[stoped]":
            
            break;
          default:
            break;
        }
      });
    }
  );
}

var showError = function(message) {
  console.log("Error: " + message);
  $("#error").css("display", "");
};

var hideError = function() {
  $("#error").css("display", "none");
};

// Helper to show a success message after a task is added.
var showSuccess = function(task) {
  Asana.ServerModel.taskViewUrl(task, function(url) {
    var name = task.name.replace(/^\s*/, "").replace(/\s*$/, "");
    $("#new_task_link").attr("href", url);
    $("#new_task_link").text(name !== "" ? name : "unnamed task");
    $("#new_task_link").unbind("click");
    $("#new_task_link").click(function() {
      chrome.tabs.create({url: url});
      window.close();
      return false;
    });
    showView("success");
  });
};

// Helper to show the login page.
var showLogin = function(url) {
  $("#login_link").attr("href", url);
  $("#login_link").unbind("click");
  $("#login_link").click(function() {
    chrome.tabs.create({url: url});
    window.close();
    return false;
  });
  showView("login");
};

// Close the popup if the ESCAPE key is pressed.
window.addEventListener("keydown", function(e) {
  if (e.keyCode === 27) {
    window.close();
  }
}, /*capture=*/false);

$("#close-banner").click(function() { window.close(); });
