"use strict";
function Conf() {
    let self = this;
    self.midiInDeviceId = null;
    self.midiOutDeviceId = null;
    self.midiInChannel = 1; // 1-based 
    self.midiOutChannel = 1;
    self.mouseWheelFaders = false;
    self.pgmChange = null;
    self.pfx = "";
    self.storageKeys = ["midiInDeviceId", "midiOutDeviceId", "midiInChannel", "midiOutChannel", "mouseWheelFaders", "pgmChange", "lastPatch"];
    self.loadSettings = function () {
        self.storageKeys.forEach(function (key) {
            let elemId = "#" + key;
            let type = $(elemId).prop("tagName");
            self[key] = localStorage.getItem(self.pfx + key) || (type === "SELECT" ? $(elemId + " option:selected").val() : $(elemId).prop("checked"));
            if (type === "SELECT") {
                $(elemId).val(self[key]);
            }
            else {
                let itype = $(elemId).attr('type');
                if (itype === 'checkbox') {
                    self[key] = ("true" === self[key]);
                    $(elemId).prop("checked", self[key]);
                }
                else {
                    $(elemId).val(self[key]);
                }
            }
        });
        console.log("Loaded settings");
    };
    self.saveSettings = function () {
        self.storageKeys.forEach(function (key) {
            let elemId = "#" + key;
            let type = $(elemId).prop("tagName");
            switch (type) {
                case 'SELECT':
                    self[key] = $(elemId + " option:selected").val();
                    break;
                case 'INPUT':
                    let itype = $(elemId).attr('type');
                    self[key] = itype === 'checkbox' ? $(elemId).prop("checked") : $(elemId).val();
            }
            // self[key] = type==="SELECT"?$(elemId+" option:selected").val():$(elemId).prop("checked");
            localStorage.setItem(self.pfx + key, self[key]);
        });
        console.log("Saved settings");
    };
    self.setPrefix = function (pfx) {
        self.pfx = pfx;
    }
    self.getPatchKey = function (number) {
        return self.pfx + "patch" + number;
    }

    self.savePatch = function (number, midi) {
        let name = prompt("Name your patch", self.getPatchName(number, true) || "");
        if (name) {
            localStorage.setItem(self.getPatchKey(number), JSON.stringify(midi.ccStorage));
            localStorage.setItem(self.getPatchKey(number) + "_name", name);
            console.log("Saved patch #" + number);
            console.log(midi.ccStorage);
            $("#lastPatch").val(number).change();
            return name;
        }
        return null;
    }

    self.loadPatch = function (number, midi) {
        let patchdata = localStorage.getItem(self.getPatchKey(number));
        if (patchdata) {
            midi.ccStorage = JSON.parse(patchdata);
            let setValues = {};
            for (let cc in midi.ccStorage) {
                let val = midi.ccStorage[cc];
                $("*[data-cc=" + cc + "]").each(function () {
                    let el = $(this);
                    el.trigger("midi:update", [val]);
                });
                setValues[cc] = true;
            }
            $("*[data-cc]").each(function () {
                let el = $(this);
                if (!setValues[el.data("cc")]) {
                    el.trigger("midi:update", [0]);
                }
            });
            $("#lastPatch").val(number).change();
            console.log("Loaded patch #" + number);
            return self.getPatchName(number);
        }
        return null;
    }

    self.hasStoredPatch = function (number) {
        return localStorage.getItem(self.getPatchKey(number)) != null;
    }

    self.getPatchName = function (number, unnormaled) {
        let name = localStorage.getItem(self.getPatchKey(number) + "_name");
        if (unnormaled) {
            return name;
        }
        else {
            return name || "…";
        }
    }
    let magicId = "PaTcHlIsT";
    self.exportPatches = function () {
        $("#copypaste").show();
        let list = [];
        for (let i = 0; i < 128; i++) {
            if (self.hasStoredPatch(i)) {
                try {
                    let patchdata = JSON.parse(localStorage.getItem(self.getPatchKey(i)));
                    patchdata["_name_"] = self.getPatchName(i);
                    list.push(patchdata);
                }
                catch (err) {
                    console.log(err);
                }
            }
        }
        if (list.length == 0) {
            alert("Sorry, you haven't created any patches to export yet.");
            return;
        }
        list.unshift(magicId, self.pfx, new Date());
        $("#copypaste").val(JSON.stringify(list));
        $("#copypaste").select();
        let successful = false;
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

    self.importPatches = function () {
        let data = prompt("Step 1 of 2:\n\nPaste the exported patch list text here from your clipboard and press OK!", "");
        if (data) {
            try {
                let stuff = JSON.parse(data);
                if (Array.isArray(stuff) && stuff.length > 3 && stuff[0] == magicId) {
                    if (stuff[1] != self.pfx && !confirm("The data is from a different controller configuration (from '" + stuff[1] + "', but this is '" + self.pfx + "').\nImport anyway?")) {
                        return;
                    }
                    let overwrite = confirm("Step 2 of 2:\n\nAppend or Overwrite?\n\nSelect OK to append the import to your patch list. If you press CANCEL, your current patches will be overwritten!");
                    let insertPos = 0;
                    let freeslotscount = 0;
                    for (let i = 0; i < 128; i++) {
                        if (overwrite) {
                            freeslotscount++;
                            localStorage.removeItem(self.getPatchKey(i));
                            localStorage.removeItem(self.getPatchKey(i) + "_name");
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
                    let importcount = stuff.length - 3;
                    if (freeslotscount < importcount) {
                        alert("Not enough space to import the patches! Import has " + importcount + " patches but only " + freeslotscount + " positions are free.");
                        return;
                    }
                    for (let i = 3; i < stuff.length; i++) {
                        // find next free position
                        while (self.hasStoredPatch(insertPos)) {
                            insertPos = (insertPos + 1) % 128;
                        }
                        let patch = stuff[i];
                        localStorage.setItem(self.getPatchKey(insertPos), JSON.stringify(patch));
                        localStorage.setItem(self.getPatchKey(insertPos) + "_name", patch._name_);
                    };
                }
                else {
                    throw new Error("Unknown format");
                }
            }
            catch (err) {
                alert("Something went wrong!\n" + err);
            }
        }
    }
    self.deletePatch = function (number) {
        localStorage.removeItem(self.getPatchKey(number));
        localStorage.removeItem(self.getPatchKey(number) + "_name");
    }
    self.patchCount = function () {
        let count = 0;
        for (let i = 0; i < 128; i++) {
            if (self.hasStoredPatch(i)) {
                count++;
            }
        }
        return count;
    }
    self.importDefaults = function (data) {
        try {
            let cnt = 0;
            for (let i = 3; i < data.length; i++) {
                let patch = data[i];
                localStorage.setItem(self.getPatchKey(i), JSON.stringify(patch));
                localStorage.setItem(self.getPatchKey(i) + "_name", patch._name_);
                cnt++;
            };
            console.log("Imported", cnt, "default patches.");
        }
        catch (err) {
            console.log("Error importing default patches:", err);
        }
    }
};
let conf = new Conf();

function MIDI() {
    console.log("Initializing MIDI...");
    let self = this;
    self.midiAccess = null;
    self.ccStorage = {};
    self.onMIDISuccess = function (midiAccess) {
        console.log("MIDI ready!");
        self.midiAccess = midiAccess;
        self.listInputsAndOutputs();
        conf.loadSettings();
        self.startMIDIInput();
        self.sendProgramChange(conf.pgmChange);
        setTimeout(function () { // TODO no timeout but really triggered
            $("*[data-number=" + $("#lastPatch").val() + "]").click();
        }, 300);
    }
    self.onMIDIFailure = function (msg) {
        console.log("Failed to get MIDI access - " + msg);
        alert("No MIDI! :-()\n", msg);
    }
    self.listInputsAndOutputs = function () {
        for (let entry of self.midiAccess.inputs) {
            let input = entry[1];
            $("#midiInDeviceId").append("<option value=\"" + input.id + "\">" + input.name + "</option>");
        }
        for (let entry of self.midiAccess.outputs) {
            let output = entry[1];
            $("#midiOutDeviceId").append("<option value=\"" + output.id + "\">" + output.name + "</option>");
        }
    }
    self.onMIDIMessage = function (event) {
        if (event.data.length == 3) {
            let msgchannel = (event.data[0] & 0x0f);
            let message = (event.data[0] & 0x70) >> 4;
            if (msgchannel == conf.midiOutChannel - 1 && message == 3) { // control change on selected channel
                let cc = event.data[1];
                let val = event.data[2];
                $("*[data-cc=" + cc + "]").each(function () {
                    let el = $(this);
                    el.trigger("midi:update", [val]);
                });
            }
        }
    }
    self.startMIDIInput = function () {
        let input = self.midiAccess.inputs.get(conf.midiInDeviceId);
        if (input) {
            self.midiAccess.inputs.forEach(function (entry) { entry.onmidimessage = undefined; });
            input.onmidimessage = self.onMIDIMessage;
            console.log("Selected " + input.name + ", channel " + conf.midiInChannel + " for input!");
        }
        else {
            console.log("No input device selected!");
        }
    }
    self.sendCC = function (cc, value) {
        if (cc) {
            let portId = conf.midiOutDeviceId;
            let channel = conf.midiOutChannel;
            let output = self.midiAccess.outputs.get(portId);
            if (output) {
                output.send([176 + (channel - 1), cc, parseInt(value)]);
            }
            self.ccStorage[cc] = value;
        }
    }
    self.sendProgramChange = function (pgm) {
        if (pgm && pgm < 129) {
            let portId = conf.midiOutDeviceId;
            let channel = conf.midiOutChannel;
            let output = self.midiAccess.outputs.get(portId);
            if (output) {
                output.send([192 + (channel - 1), pgm - 1]);
            }
        }
    }
    if ('function' === typeof window.navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(self.onMIDISuccess, self.onMIDIFailure);
    }
    else {
        alert("Sorry, no MIDI support in this browser.");
    }
}

function GrayMod(base, val) {
    if (val > 0) {
        base += 50;
    }
    if (val < 0) {
        base -= 30;
    }
    let h = (base).toString(16);
    h = h.length == 1 ? '0' + h : h;
    return "#" + h + h + h;
}

$(function () {
    (function () {
        let link = document.createElement('link');
        link.type = 'image/png';
        link.rel = 'shortcut icon';
        link.href = 'res/favicon.png';
        document.getElementsByTagName('head')[0].appendChild(link);
    } ());

    let settingsprefix = $("*[data-settings-prefix]").data("settings-prefix");
    conf.setPrefix(settingsprefix || "");
    let midi = new MIDI();

    if (conf.patchCount() == 0 && $("*[data-default-patchlist]").length) {
        conf.importDefaults($("*[data-default-patchlist]").data("default-patchlist"));
    }

    (function buildSettingsUI() {
        $("<div id='settings'><input type='hidden' id='lastPatch'/><table><tr><th></th><th>Device</th><th>Channel</th></tr><tr><td>Out:</td><td><select id='midiOutDeviceId'></select></td><td><select id='midiOutChannel'></select></td></tr><tr><td>In:</td><td><select id='midiInDeviceId'></select></td><td><select id='midiInChannel'></select></td></tr><tr><td colspan='2'>Program change on load:</td><td><input type='text' id='pgmChange' title='Leave empty, if not' size='3'/></td></tr></table><br /><input type='checkbox' id='mouseWheelFaders'/><label for='mouseWheelFaders'>Mouse wheel on faders</label></div>").appendTo("header");
        for (let ch = 0; ch < 16; ch++) {
            $("#midiOutChannel, #midiInChannel").append("<option>" + (ch + 1) + "</option>");
        }
        $("#settings select").change(function () {
            conf.saveSettings();
            midi.startMIDIInput();
        });
        $("#mouseWheelFaders").change(function () {
            conf.saveSettings();
        });
        $("#pgmChange").change(function () {
            conf.saveSettings();
        });
        $("#lastPatch").change(function () {
            conf.saveSettings();
        });
        $("header").prepend("<button data-toggles='settings'>SETTINGS</button>");
    })();

    let buildPatchesUI = function buildPatchesUI(showme) {
        $("#patches").remove();
        $("<div id='patches'class='open'><h2><button data-toggles='patches'>Close</button><button id='sendbutton' class='pull-right'>Send Current Panel</button><button id='importbutton' class='pull-right'>Import</button><button id='exportbutton' class='pull-right'>Export</button>PATCHES<button id='savebutton'>SAVE</button></h2><div><textarea id='copypaste'></textarea></div><div id='patchlist'></div></div>").appendTo("body");
        $("#sendbutton").click(function () {
            $("main *").trigger("patch:send");
            $("main input").change();
        });
        $("#exportbutton").click(function () {
            conf.exportPatches();
        });
        $("#importbutton").click(function () {
            conf.importPatches();
            buildPatchesUI(true);
        });
        for (let i = 0; i < 128; i++) {
            let emptyClass = conf.hasStoredPatch(i) ? "" : " empty";
            $("#patchlist").append("<div class='pc" + emptyClass + "' data-number='" + i + "'><div class='patch'><a class='del'>X</a>" + (i + 1) + "</div><span>" + conf.getPatchName(i) + "</span></div>");
        }
        if (showme) {
            $("#patches").addClass("open");
        }
        let savemode = false;
        $("#savebutton").click(function() {
            savemode = !savemode;
            if (savemode) {
                $("#patches").addClass("savemode");
            }
            else {
                $("#patches").removeClass("savemode");
            };
        });
        $("#patchlist a.del").click(function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            let number = $(this).closest(".pc").data("number");
            if (confirm("Do you really want to delete patch #" + (number + 1) + ": " + conf.getPatchName(number) + "?")) {
                conf.deletePatch(number);
                buildPatchesUI(true);
            }
        });
        $("#patchlist .pc").click(function () {
            let number = $(this).data("number");
            if (savemode) {
                $("main input").change();
                let name = conf.savePatch(number, midi);
                if (name) {
                    $(this).removeClass("empty");
                    $(this).find("span").text(conf.getPatchName(number));
                    $("#patchlist .pc").removeClass("selected");
                    $(this).addClass("selected");
                    $("#savebutton").click();
                    $("header h1 span").text(name);
                }
            }
            else {
                let name = conf.loadPatch(number, midi);
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

    $("*[data-toggles]").click(function () {
        let toggle = $(this).data("toggles");
        $("#" + toggle).toggleClass("open");
    });

    let usedccs = {};

    $(".rotary").each(function () {
        let el = $(this);
        let isBipolar = el.hasClass("bipolar");
        let initval = el.data("init") || 0;
        let ccvalue = initval;
        let recentValue = initval;
        el.append("<label>" + el.data("label") + "</label><div class='ctrl'><div class=\"center\"></div><div class=\"handle\"></div><span class=\"value\"></span></div>");
        let dispvalue = el.find(".value");
        let handle = el.find(".handle");
        let ctrl = el.find(".ctrl");
        let cc = el.data("cc");
        el.find("label").click(function (ev) {
            ev.preventDefault();
            update(64);
        });
        let update = function (val) {
            let ang = parseInt((270 * (val / 127.0)) - 135);
            handle.css({ "transform": "rotate(" + ang + "deg)" });
            ccvalue = val;
            if (isBipolar) {
                let dispv = ccvalue - 64;
                dispvalue.text(dispv > 0 ? '+' + dispv : dispv);
                ctrl.css('background-color', GrayMod(0x66, dispv));
            }
            else {
                dispvalue.text(ccvalue);
            }
            if (recentValue != val) {
                recentValue = val;
                midi.sendCC(cc, ccvalue);
            }
        };
        update(initval);
        let updateFromCoords = function (x, y) {
            let y0 = y - (ctrl.offset().top + ctrl.height() / 2);
            let x0 = x - (ctrl.offset().left + ctrl.width() / 2);
            let ang = parseInt(Math.atan2(y0, x0) * (180 / Math.PI));
            if (ang < 0 && ang >= -90) { // TODO clean up matching areas
                ang += 225;
            }
            else if (ang >= 0 && ang < 45) {
                ang += 225;
            }
            else if (ang < -90) {
                ang += 225;
            }
            else if (ang > 135) {
                ang -= 135;
            }
            else {
                if (ang < 90) {
                    ang = 270;
                }
                else {
                    ang = 0;
                }
            }
            let val = (ang / 270.0) * 127;
            update(parseInt(val));
        }
        update(initval);
        el.on("midi:update", function (ev, value) {
            update(value);
        });
        el.on("patch:send", function (ev) {
            recentValue = -1;
            update(ccvalue);
        });

        let isDragging = false;
        el.mousedown(function (ev) {
            ev.preventDefault();
            updateFromCoords(ev.pageX, ev.pageY);
            isDragging = true;
            handle.addClass("dragging");
        })
            .on("mousewheel", function (ev) {
                if (conf.mouseWheelFaders) {
                    ev.preventDefault();
                    let dir = ev.originalEvent.wheelDelta > 0 ? 1 : -1;
                    let val = parseInt(input.val()) + ev.originalEvent.wheelDelta / 8.0;
                    val = Math.max(0, Math.min(val, 127));
                    update(parseInt(val));
                }
            });
        $(window).mousemove(function (ev) {
            if (isDragging) {
                ev.preventDefault();
                updateFromCoords(ev.pageX, ev.pageY);
            }
        })
            .mouseup(function (ev) {
                if (isDragging) {
                    ev.preventDefault();
                    updateFromCoords(ev.pageX, ev.pageY);
                    isDragging = false;
                    handle.removeClass("dragging");
                }
            });



    });

    $(".fader, .fader-horz").each(function () {
        // disclaimer: the horizontal fader implementation is ugly. needs clean-up and generalisation. don't be to critical, please
        let el = $(this);
        let isHorizontal = el.hasClass("fader-horz");
        let isBipolar = el.hasClass("bipolar");
        let initval = el.data("init") || 0;
        let ccvalue = initval;
        if (isHorizontal) {
            el.append("<label>" + el.data("label") + "</label><div class='ctrl'><div class=\"scale\"></div><span class='center'></span><div class=\"handle\"></div><div class=\"value\"></div></div>");
        }
        else {
            el.append("<label>" + el.data("label") + "</label><div class='ctrl'><div class=\"scale\"></div><span class='center'></span><div class=\"handle value\"></div></div>");
        }
        let handle = el.find(".handle");
        let handleMiddle = (isHorizontal?handle.width():handle.height()) / 2;
        let ctrl = el.find(".ctrl");
        let valueDisplay = el.find('.value');
        let scale = isHorizontal?ctrl.width() - handle.width():ctrl.height() - handle.height();
        let recentValue = initval;
        let cc = el.data("cc");
        usedccs[cc] = (usedccs[cc] ? usedccs[cc] : "") + el.data("label") + " ";
        el.attr("title", "cc:" + cc);
        el.find("label").click(function (ev) {
            ev.preventDefault();
            update(64);
            handle.css(isHorizontal?{ "left": ccvalue / 127 * scale }:{ "top": (127 - ccvalue) / 127 * scale });
        });
        handle.css(isHorizontal?{ "left": ccvalue / 127 * scale }:{ "top": (127 - ccvalue) / 127 * scale });

        el.on("midi:update", function (ev, value) {
            recentValue = -1; // force update!
            ccvalue = value;
            handle.css(isHorizontal?{ "left": (127 - ccvalue) / 127 * scale }:{ "top": (127 - ccvalue) / 127 * scale });
            update(ccvalue);
        });
        el.on("patch:send", function (ev) {
            recentValue = -1;
            update(ccvalue);
        });

        let update = function (ccv) {
            ccvalue = ccv;
            if (isBipolar) {
                let dispv = ccvalue - 64;
                valueDisplay.text(dispv > 0 ? '+' + dispv : dispv);
            }
            else {
                valueDisplay.text(ccvalue);
            }
            if (recentValue != ccv) {
                recentValue = ccv;
                midi.sendCC(cc, ccv);
            }
        }
        update(initval);

        let updatePos = function (pos) {
            if (pos > scale) {
                pos = scale;
            }
            if (pos < 0) {
                pos = 0;
            }
            handle.css(isHorizontal?{ "left": pos }:{ "top": pos });
            update(isHorizontal?parseInt((pos / scale) * 127.0):parseInt(127 - (pos / scale) * 127.0));
        }
        let isDragging = false;
        el.mousedown(function (ev) {
            ev.preventDefault();
            if (ev.target != handle[0]) {
                let ps = isHorizontal?(ev.pageX - handle.offset().left):(ev.pageY - handle.offset().top);
                let val = ccvalue;
                if (ps < 0) {
                    val += isHorizontal?-12:12;
                }
                else {
                    val -= isHorizontal?-12:12;
                }
                val = Math.max(0, Math.min(val, 127));
                updatePos((isHorizontal?val:(127 - val)) / 127.0 * scale); // todo generalize
            }
            else {
                let clickedPos = isHorizontal?(ev.pageX - ctrl.offset().left - handleMiddle):(ev.pageY - ctrl.offset().top - handleMiddle);
                isDragging = true;
                handle.addClass("dragging");
                updatePos(clickedPos);
            }
        })
            .on("mousewheel", function (ev) {
                if (conf.mouseWheelFaders) {
                    ev.preventDefault();
                    let dir = ev.originalEvent.wheelDelta > 0 ? 1 : -1;
                    let val = ccvalue + ev.originalEvent.wheelDelta / 8.0;
                    val = Math.max(0, Math.min(val, 127));
                    updatePos((isHorizontal?val:(127 - val)) / 127.0 * scale);
                }
            });
        $(window).mousemove(function (ev) {
            if (isDragging) {
                ev.preventDefault();
                updatePos(isHorizontal?(ev.pageX - ctrl.offset().left - handleMiddle):(ev.pageY - ctrl.offset().top - handleMiddle));
            }
        })
            .mouseup(function (ev) {
                if (isDragging) {
                    ev.preventDefault();
                    updatePos(isHorizontal?(ev.pageX - ctrl.offset().left - handleMiddle):(ev.pageY - ctrl.offset().top - handleMiddle));
                    isDragging = false;
                    handle.removeClass("dragging");
                }
            });
    });
    let aggregated = [];
    $("input").each(function () {
        let el = $(this);
        let cc = el.data("cc");
        if (cc !== undefined) {
            el.next("label").attr("title", "cc:" + cc);
            usedccs[cc] = (usedccs[cc] ? usedccs[cc] : "") + el.next("label").text() + " ";
        }
    });
    $("input[type=checkbox]").on("change", function (e) {
        let el = $(this);
        let cc = el.data("cc");
        let bitval = el.data("bit");
        let checked = el.prop("checked");
        if (bitval) {
            aggregated[cc] = checked ? (aggregated[cc] | bitval) : (aggregated[cc] & (255 - bitval));
            midi.sendCC(cc, aggregated[cc]);
        }
        else {
            midi.sendCC(cc, checked ? 64 : 0);
        }
    });
    $("input[type=checkbox]").on("midi:update", function (e, val) {
        let el = $(this);
        let cc = el.data("cc");
        let bitval = el.data("bit");
        if (bitval) {
            let checked = (val & bitval) > 0;
            el.prop("checked", checked);
            aggregated[cc] = checked ? (aggregated[cc] | bitval) : (aggregated[cc] & (255 - bitval));
        }
        else {
            el.prop("checked", val > 0);
        }
    });

    $("input[type=radio]").on("change", function (e) {
        let el = $(this);
        let cc = el.data("cc");
        let val = el.val();
        let checked = el.prop("checked");
        if (checked) {
            midi.sendCC(cc, val);
        }
    });
    $("input[type=radio]").on("midi:update", function (e, val) {
        let el = $(this);
        let cc = el.data("cc");
        el.prop("checked", el.val() == val);
    });

    //console.log(usedccs);

});
