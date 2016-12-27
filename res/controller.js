function Conf() {
    var self = this;
    self.midiInDeviceId = null; 
    self.midiOutDeviceId = null;
    self.midiInChannel = 1; // 1-based 
    self.midiOutChannel = 1;
    self.mouseWheelFaders = false;
    self.pfx = "";
    self.storageKeys = ["midiInDeviceId","midiOutDeviceId","midiInChannel","midiOutChannel","mouseWheelFaders"];
    self.loadSettings = function() {
        self.storageKeys.forEach(function(key) {
            var elemId = "#"+key;
            var type = $(elemId).prop("tagName");
            self[key] = localStorage.getItem(self.pfx+key)||(type==="SELECT"?$(elemId+" option:selected").val():$(elemId).prop("checked"));
            if (type==="SELECT") {
                $(elemId).val(self[key]);
            }
            else {
                self[key] = ("true"===self[key]);
                $(elemId).prop("checked", self[key]);
            }
            console.log(key, self[key]); 
        });
    };
    self.saveSettings = function() {
        self.storageKeys.forEach(function(key) {
            var elemId = "#"+key;
            var type = $(elemId).prop("tagName");
            self[key] = type==="SELECT"?$(elemId+" option:selected").val():$(elemId).prop("checked");
            localStorage.setItem(self.pfx+key, self[key]);
            console.log(key, self[key]);
        });
        console.log("Saved settings");
    };
    self.setPrefix = function(pfx) {
        self.pfx = pfx;
    }
    self.getPatchKey = function(number) {
        return self.pfx+"patch"+number;
    }

    self.savePatch = function(number, midi) {
        var name = prompt("Name your patch", self.getPatchName(number,true)||"");
        if (name) {
            localStorage.setItem(self.getPatchKey(number), JSON.stringify(midi.ccStorage));
            localStorage.setItem(self.getPatchKey(number)+"_name", name);
            console.log("Saved patch #"+number);
            console.log(midi.ccStorage);
            return name;
        }
        return null;
    }

    self.loadPatch = function(number, midi) {
        var patchdata = localStorage.getItem(self.getPatchKey(number));
        if (patchdata) {
            midi.ccStorage = JSON.parse(patchdata);
            var setValues = {};
            for (var cc in midi.ccStorage) {
                var val = midi.ccStorage[cc];
                $("*[data-cc="+cc+"]").each(function() {
                    var el = $(this);
                    el.trigger("midi:update", [val]);
                });
                setValues[cc] = true;
            }
            $("*[data-cc]").each(function() {
                var el = $(this);
                if (!setValues[el.data("cc")]) {
                    el.trigger("midi:update", [0]);
                }
            });
            console.log("Loaded patch #"+number);
            return self.getPatchName(number);
        }
        return null;
    }

    self.hasStoredPatch = function(number) {
        return localStorage.getItem(self.getPatchKey(number))!=null;
    }

    self.getPatchName = function(number, unnormaled) {
        var name = localStorage.getItem(self.getPatchKey(number)+"_name");
        if (unnormaled) {
            return name;
        }
        else {
            return name||"…";
        }
    }
    var magicId = "PaTcHlIsT";
    self.exportPatches = function() {
        $("#copypaste").show();
        var list = [];
        for (var i=0;i<128;i++) {
            if (self.hasStoredPatch(i)) {
                try {
                    var patchdata = JSON.parse(localStorage.getItem(self.getPatchKey(i)));
                    patchdata["_name_"] = self.getPatchName(i);
                    list.push(patchdata);
                }
                catch(err) {
                    console.log(err);
                }
            }
        }
        if (list.length==0) {
            alert("Sorry, you haven't created any patches to export yet.");
            return;
        }
        list.unshift(magicId, self.pfx, new Date());
        $("#copypaste").val(JSON.stringify(list));
        $("#copypaste").select();
        var successful=false;
        try {
            successful = document.execCommand('copy');
        } catch (err) {
            console.log(err);
        }
        if (successful) {
            alert("Patch list data has been copied to your computer's clipboard! You can now for example paste it into a text file or send it via e-mail.");
        }
        else {
            alert("Copying didn't work. Sorry for the inconvenience! Check browser console and report the error.");
        }
        $("#copypaste").hide();
    }

    self.importPatches = function() {
        var data = prompt("Step 1 of 2:\n\nPaste the exported patch list text here from your clipboard and press OK!", "");
        if (data) {
            try {
                var stuff = JSON.parse(data);
                if (Array.isArray(stuff) && stuff.length>3 && stuff[0]==magicId) {
                    if (stuff[1]!=self.pfx && !confirm("The data is from a different controller configuration (from '"+stuff[1]+"', but this is '"+self.pfx+"').\nImport anyway?")) {
                        return;
                    }
                    var overwrite = confirm("Step 2 of 2:\n\nAppend or Overwrite?\n\nSelect OK to append the import to your patch list. If you press CANCEL, your current patches will be overwritten!");
                    var insertPos = 0;
                    var freeslotscount = 0;
                    for (var i=0;i<128;i++) {
                        if (overwrite) {
                            freeslotscount++;
                            localStorage.removeItem(self.getPatchKey(i));
                            localStorage.removeItem(self.getPatchKey(i)+"_name");
                        }
                        else {
                            if (self.hasStoredPatch(i)) {
                                insertPos = i;
                            }
                            else {
                                freeslotscount++;
                            }
                        }
                    }
                    var importcount = stuff.length-3;
                    if (freeslotscount<importcount) {
                        alert("Not enough space to import the patches! Import has "+importcount+" patches but only "+freeslotscount+" positions are free.");
                        return;
                    }
                    for (var i=3;i<stuff.length;i++) {
                        // find next free position
                        while (self.hasStoredPatch(insertPos)) {
                            insertPos = (insertPos+1)%128;
                        }
                        var patch = stuff[i];
                        localStorage.setItem(self.getPatchKey(insertPos), JSON.stringify(patch));
                        localStorage.setItem(self.getPatchKey(insertPos)+"_name", patch._name_);
                    };
                }
                else {
                    throw new Error("Unknown format");
                }
            }
            catch(err) {
                alert("Something went wrong!\n"+err);
            }
        }
    }
    self.deletePatch = function(number) {
        localStorage.removeItem(self.getPatchKey(number));
        localStorage.removeItem(self.getPatchKey(number)+"_name");
    }
    self.patchCount = function() {
        var count = 0;
        for (var i=0;i<128;i++) {
            if (self.hasStoredPatch(i)) {
                count++;
            }
        }
        return count;
    }
    self.importDefaults = function(data) {
        try {
            var cnt = 0;
            for (var i=3;i<data.length;i++) {
                var patch = data[i];
                localStorage.setItem(self.getPatchKey(i), JSON.stringify(patch));
                localStorage.setItem(self.getPatchKey(i)+"_name", patch._name_);
                cnt++;
            };
            console.log("Imported", cnt, "default patches.");
        }
        catch(err) {
            console.log("Error importing default patches:", err);
        }
    }
};
var conf = new Conf();

function MIDI() {
    console.log("Initializing MIDI...");
    var self = this;
    self.midiAccess = null;
    self.ccStorage = {};
    self.onMIDISuccess = function(midiAccess) {
        console.log("MIDI ready!");
        self.midiAccess = midiAccess;
        self.listInputsAndOutputs();
        conf.loadSettings();
        self.startMIDIInput();
    }
    self.onMIDIFailure = function(msg) {
        console.log("Failed to get MIDI access - " + msg );
        alert("No MIDI! :-()\n", msg);
    }
    self.listInputsAndOutputs = function() {
        for (var entry of self.midiAccess.inputs) {
            var input = entry[1];
            $("#midiInDeviceId").append("<option value=\""+input.id+"\">"+input.name+"</option>");
        }
        for (var entry of self.midiAccess.outputs) {
            var output = entry[1];
            $("#midiOutDeviceId").append("<option value=\""+output.id+"\">"+output.name+"</option>");
        }
    }
    self.onMIDIMessage = function(event) {
        if (event.data.length==3) {
            var msgchannel = (event.data[0] & 0x0f);
            var message = (event.data[0] & 0x70)>>4;
            if (msgchannel==conf.midiOutChannel-1 && message==3) { // control change on selected channel
                var cc = event.data[1];
                var val = event.data[2];
                $("*[data-cc="+cc+"]").each(function() {
                    var el = $(this);
                    el.trigger("midi:update", [val]);
                });
            }
        }
    }
    self.startMIDIInput = function() {
        var input = self.midiAccess.inputs.get(conf.midiInDeviceId);
        if (input) {
            self.midiAccess.inputs.forEach( function(entry) {entry.onmidimessage = undefined; });
            input.onmidimessage = self.onMIDIMessage;
            console.log("Selected "+input.name+", channel "+conf.midiInChannel+" for input!");
        }
        else {
            console.log("No input device selected!");
        }
    }
    self.sendCC = function(cc, value) {
        if (cc) {
            var portId = conf.midiOutDeviceId;
            var channel = conf.midiOutChannel;
            var output = self.midiAccess.outputs.get(portId);
            if (output) {
                output.send([176+(channel-1), cc, parseInt(value)]);
            }
            self.ccStorage[cc] = value;
        }
    }
    if ('function' === typeof window.navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(self.onMIDISuccess, self.onMIDIFailure);
    }
    else {
        alert("Sorry, no MIDI support in this browser.");
    }
}

$(function() {
    var settingsprefix = $("*[data-settings-prefix]").data("settings-prefix");
    conf.setPrefix(settingsprefix||"");
    var midi = new MIDI();

    if (conf.patchCount()==0 && $("*[data-default-patchlist]").length) {
        conf.importDefaults($("*[data-default-patchlist]").data("default-patchlist"));
    }

    (function buildSettingsUI() {
        $("<div id='settings'><table><tr><th></th><th>Device</th><th>Channel</th></tr><tr><td>Out:</td><td><select id='midiOutDeviceId'></select></td><td><select id='midiOutChannel'></select></td></tr><tr><td>In:</td><td><select id='midiInDeviceId'></select></td><td><select id='midiInChannel'></select></td></tr></table><input type='checkbox' id='mouseWheelFaders'/><label for='mouseWheelFaders'>Mouse wheel on faders</label></div>").appendTo("header");
        for (var ch=0;ch<16;ch++) { 
            $("#midiOutChannel, #midiInChannel").append("<option>"+(ch+1)+"</option>");
        }
        $("#settings select").change(function() {
            conf.saveSettings();
            midi.startMIDIInput();
        });
        $("#mouseWheelFaders").change(function() {
            conf.saveSettings();
        });
        $("header").prepend("<button data-toggles='settings'>SETTINGS</button>");
    })();

    var buildPatchesUI = function buildPatchesUI(showme) {
        $("#patches").remove();
        $("<div id='patches'class='open'><h2><button data-toggles='patches'>Close</button>PATCHES</h2><p><input type='checkbox' id='save' class='switch'/><label for='save'>Save...</label> <button id='sendbutton' class='pull-right'>Send Current Panel</button><button id='importbutton' class='pull-right'>Import</button><button id='exportbutton' class='pull-right'>Export</button></p><div><textarea id='copypaste'></textarea></div><div id='patchlist'></div></div>").appendTo("body");
        $("#sendbutton").click(function() {
            $("main input").change();
        }); 
        $("#exportbutton").click(function() {
            conf.exportPatches();
        }); 
        $("#importbutton").click(function() {
            conf.importPatches();
            buildPatchesUI(true);
        });
        for (var i=0;i<128;i++) {
            var emptyClass = conf.hasStoredPatch(i)?"":" empty";
            $("#patchlist").append("<div class='pc"+emptyClass+"' data-number='"+i+"'><div class='patch'><a class='del'>X</a>"+(i+1)+"</div><span>"+conf.getPatchName(i)+"</span></div>");
        }
        if (showme) {
            $("#patches").addClass("open");
        }
        var savemode = false;
        $("#save").change(function() {
            savemode = $("#save").prop("checked"); 
            if (savemode) {
                $("#patchlist").addClass("savemode");
            }
            else {
                $("#patchlist").removeClass("savemode");
            };
        });
        $("#patchlist a.del").click(function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var number = $(this).closest(".pc").data("number");
            if (confirm("Do you really want to delete patch #"+(number+1)+": "+conf.getPatchName(number)+"?")) {
                conf.deletePatch(number);
                buildPatchesUI(true);
            }
        });
        $("#patchlist .pc").click(function() {
            var number = $(this).data("number");
            if (savemode) {
                $("main input").change();
                var name = conf.savePatch(number, midi); 
                if (name) {
                    $(this).removeClass("empty");
                    $(this).find("span").text(conf.getPatchName(number));
                    $("#patchlist .pc").removeClass("selected");
                    $(this).addClass("selected");
                    $("#save").prop("checked", false);
                    $("#save").change();
                    $("header h1 span").text(name);
                }
            }
            else {
                var name = conf.loadPatch(number, midi);
                if (name) {
                    $("main input").change();
                    $("#patchlist .pc").removeClass("selected");
                    $(this).addClass("selected");
                    $("header h1 span").text(name);
                }
            }
        });
    };
    buildPatchesUI();
    $("header h1").append("<span id='patchname'>Initial</span>");
    $("header").prepend("<button data-toggles='patches'>PATCHES</button>");

    $("*[data-toggles]").click(function() {
        var toggle = $(this).data("toggles");
        $("#"+toggle).toggleClass("open");
    });

    var usedccs = {};

    $(".rotary").each(function() {
        var el = $(this);
        var initval = el.data("init")||0;
        var recentValue = initval;
        el.append("<label>"+el.data("label")+"</label><div class='ctrl'><div class=\"handle\"></div><input type='text' /></div>");
        var input = el.find("input");
        var handle = el.find(".handle");
        var ctrl = el.find(".ctrl");
        var cc = el.data("cc");
        input.change(function() {
            var value = $(this).val();
            midi.sendCC(cc, value);
        });
        var update = function(val) {
            var ang = parseInt((270*(val/127.0))-135);
            handle.css({"transform":"rotate("+ang+"deg)"});
            input.val(val);
            if (recentValue!=val) {
                recentValue = val;
                input.change();
            }
        };
        var updateFromCoords = function(x, y) {
            var y0 = y - (ctrl.offset().top + ctrl.height()/2);
            var x0 = x - (ctrl.offset().left + ctrl.width()/2);
            var ang = parseInt(Math.atan2(y0, x0)*(180/Math.PI));
            if (ang<0 && ang>=-90) { // TODO clean up matching areas
                ang += 225;
            }
            else if (ang>=0 && ang<45) {
                ang +=225;
            }
            else if (ang<-90) {
                ang += 225;
            }
            else if (ang>135) {
                ang -= 135;
            }
            else {
                if (ang<90) {
                    ang = 270;
                }
                else {
                    ang = 0;
                }
            }
            var val = (ang/270.0)*127;
            update(parseInt(val));            
        }
        update(initval);
        el.on("midi:update", function(ev, value) {
            update(value);
        })

        var isDragging = false;
        el.mousedown(function(ev) {
            ev.preventDefault();
            updateFromCoords(ev.pageX, ev.pageY);
            isDragging = true;
            handle.addClass("dragging");
        })
        .dblclick(function(ev) {
            ev.preventDefault();
            update(64);
        })
        .on("mousewheel", function(ev) {
            if (conf.mouseWheelFaders) {
                ev.preventDefault();
                var dir = ev.originalEvent.wheelDelta>0?1:-1;
                var val = parseInt(input.val())+ev.originalEvent.wheelDelta/8.0;
                val = Math.max(0, Math.min(val, 127));
                update(parseInt(val));
            }
        });
        $(window).mousemove(function(ev){
            if (isDragging) {
                ev.preventDefault();
                updateFromCoords(ev.pageX, ev.pageY);
            }
        })
        .mouseup(function(ev) {
            if (isDragging) {
                ev.preventDefault();
                updateFromCoords(ev.pageX, ev.pageY);
                isDragging = false;
                handle.removeClass("dragging");
            }
        });



    });

    $(".fader").each(function() {
        var el = $(this);
        var initval = el.data("init")||0;
        el.append("<label>"+el.data("label")+"</label><div class='ctrl'><span class='center'></span><div class=\"scale\"></div><div class=\"handle\"></div></div><input type='text' />");
        var handle = el.find(".handle");
        var handleMiddle = handle.height()/2;
        var ctrl = el.find(".ctrl");
        var input = el.find("input");
        var height = ctrl.height()-handle.height();
        var recentValue = initval;
        var cc = el.data("cc");
        usedccs[cc] = (usedccs[cc]?usedccs[cc]:"")+el.data("label")+" ";
        el.attr("title", "cc:"+cc);

        handle.css({"top": (127-initval)/127*height});
        input.val(initval);

        input.change(function() {
            var value = $(this).val();
            midi.sendCC(cc, value);
        });

        el.on("midi:update", function(ev, value) {
            input.val(value);
            handle.css({"top": (127-value)/127*height});
        })

        var update = function(y) {
            if (y>height) {
                y = height;
            }
            if (y<0) {
                y = 0;
            }
            handle.css({"top": y});
            var value = parseInt(127-(y/height)*127.0);
            input.val(value);
            if (recentValue!=value) {
                recentValue = value;
                input.change();
            }
        }
        var isDragging = false;
        el.mousedown(function(ev) {
            ev.preventDefault();
            if (ev.target!=handle[0]) {
                var yps = ev.pageY - handle.offset().top;
                var val = parseInt(input.val());
                if (yps<0) {
                    val += 12;
                }
                else {
                    val -= 12;
                }
                val = Math.max(0, Math.min(val, 127));
                update((127-val)/127.0*height); // todo generalize
            }
            else {
                var clickedY = ev.pageY - ctrl.offset().top -handleMiddle;
                isDragging = true;
                handle.addClass("dragging");
                update(clickedY);
            }
        })
        .dblclick(function(ev) {
            ev.preventDefault();
            update((127-64)/127.0*height);
        })
        .on("mousewheel", function(ev) {
            if (conf.mouseWheelFaders) {
                ev.preventDefault();
                var dir = ev.originalEvent.wheelDelta>0?1:-1;
                var val = parseInt(input.val())+ev.originalEvent.wheelDelta/8.0;
                val = Math.max(0, Math.min(val, 127));
                update((127-val)/127.0*height);
            }
        });
        $(window).mousemove(function(ev){
            if (isDragging) {
                ev.preventDefault();
                var currentY = ev.pageY - ctrl.offset().top-handleMiddle;
                update(currentY);
            }
        })
        .mouseup(function(ev) {
            if (isDragging) {
                ev.preventDefault();
                var currentY = ev.pageY - ctrl.offset().top-handleMiddle;
                update(currentY);
                isDragging = false;
                handle.removeClass("dragging");
            }
        });
    });
    var aggregated = [];
    $("input").each(function() {
        var el = $(this);
        var cc = el.data("cc");
        if (cc!==undefined) {
            el.next("label").attr("title","cc:"+cc);
            usedccs[cc] = (usedccs[cc]?usedccs[cc]:"")+el.next("label").text()+" ";
        }
    });
    $("input[type=checkbox]").on("change", function(e) {
        var el = $(this);
        var cc = el.data("cc");
        var bitval = el.data("bit");
        var checked = el.prop("checked");
        if (bitval) {
            aggregated[cc] = checked?(aggregated[cc]|bitval):(aggregated[cc]&(255-bitval));
            midi.sendCC(cc, aggregated[cc]); 
        }
        else {
            midi.sendCC(cc, checked?64:0);
        }
    });
    $("input[type=checkbox]").on("midi:update", function(e, val) {
        var el = $(this);
        var cc = el.data("cc");
        var bitval = el.data("bit");       
        if (bitval) {
            var checked = (val&bitval)>0;
            el.prop("checked" , checked);
            aggregated[cc] = checked?(aggregated[cc]|bitval):(aggregated[cc]&(255-bitval));
       }
        else {
            el.prop("checked" , val>0);
        }
    });

    $("input[type=radio]").on("change", function(e) {
        var el = $(this);
        var cc = el.data("cc");
        var val = el.val();
        var checked = el.prop("checked");
        if (checked) {
            midi.sendCC(cc, val);
        }
    });
    $("input[type=radio]").on("midi:update", function(e, val) {
        var el = $(this);
        var cc = el.data("cc");
        el.prop("checked", el.val()==val);
    });

    //console.log(usedccs);

});
