$(document).ready(function() {
    webSocketConfig();
    //用来存储websocket发来的各个通道下D1到D16实时数据
    var socketData = [];
    var lockReconnect = false; //避免websocket重复连接
    //websocket连接
    //webSocketEvent();






    //创建十三个界面图表，默认隐藏
    var TableCols = ["name", "x", "y", "z", "monitorType", "eng_name"];
    var URL = "/ZcmDB|monitor_site|select * from sites order by x DESC;|";
    var data = window.selectDB(URL, TableCols);
    //console.log(data);
    for (let i in data) {
        let name = data[i]["name"];
        let eng_name = data[i]["eng_name"];
        //动态创建highChart容器，显示在桌面上
        var highChartDiv = $('<div></div>');
        highChartDiv.attr({
            "id": eng_name + 'Chart',
            "class": 'highChart'
        });
        highChartDiv.css({
            "display": 'none',
        });
        $('#desktopContent').append(highChartDiv);

        //该截面所有的通道号
        TableCols = ["ip", "channel"];
        //使用distinct达不到效果；+0因为channel是字符串类型
        URL = "/ZcmDB|sensor_info|select ip, min(channel) channel from sensors where monitor_name = '" + eng_name + "' group by channel order by channel + 0;|";
        let channelData = window.selectDB(URL, TableCols);
        //console.log(channelData);

        //当前通道号和ip
        let currChannel = channelData[0]["channel"];
        let currIp = channelData[0]["ip"];

        var series = prepareSeriesData(currChannel, currIp);


        Highcharts.setOptions({
            lang: {
                viewFullscreen: "全屏",
                printChart: '打印图表',
                downloadJPEG: '下载JPEG文件',
                downloadPDF: '下载PDF文件',
                downloadPNG: '下载PNG文件',
                downloadSVG: '下载SVG文件',
                downloadCSV: '下载CSV文件',
                downloadXLS: '下载XLS文件',
            },
            global: {
                useUTC: false
            }
        });
        let chart = Highcharts.chart(eng_name + 'Chart', {
            chart: {
                type: 'spline',
                marginRight: 10,

                events: {
                    load: function() {
                        var series = this.series;
                        setInterval(function() {
                            //console.log(socketData);
                            for (let i in socketData) {
                                let t = parseInt(socketData[i]["name"].substring(1));
                                if (t == currChannel) {
                                    let data = socketData[i]["data"];
                                    for (let j = 0; j < series.length; j++) {
                                        let y;
                                        if (j < data.length)
                                            y = data[j];
                                        else
                                            y = 0;
                                        let x = new Date().getTime();
                                        series[j].addPoint([x, y], true, true);
                                    }
                                }
                            }

                        }, 1000);

                    }
                }
            },
            exporting: {
                enabled: true,
                buttons: {
                    contextButton: {
                        y: 30,
                        menuItems: [
                            Highcharts.getOptions().exporting.buttons.contextButton.menuItems[0],
                            Highcharts.getOptions().exporting.buttons.contextButton.menuItems[1],
                            Highcharts.getOptions().exporting.buttons.contextButton.menuItems[3],
                            Highcharts.getOptions().exporting.buttons.contextButton.menuItems[4],
                            Highcharts.getOptions().exporting.buttons.contextButton.menuItems[5],
                            Highcharts.getOptions().exporting.buttons.contextButton.menuItems[6],
                            Highcharts.getOptions().exporting.buttons.contextButton.menuItems[8],
                            Highcharts.getOptions().exporting.buttons.contextButton.menuItems[9],
                        ]
                    },
                    // symbol:['circle', 'diamond', 'square', 'triangle', 'triangle-down','menu'],
                    minButton: {
                        symbol: 'triangle-down',
                        symbolStrokeWidth: 1,
                        y: 30,
                        onclick: function() {
                            $("#" + eng_name + "Chart").hide();
                        }
                    },
                }
            },
            boost: {
                useGPUTranslations: true
            },
            title: {
                text: name + '-通道' + currChannel + '-实时数据'
            },
            subtitle: {
                useHTML: true,
                align: 'left',
                text: '通道编号:    <span id="' + eng_name + 'Radios"></span>'
            },
            xAxis: {
                type: 'datetime',
                tickInterval: 1000, //单位：毫秒   
                dateTimeLabelFormats: {
                    day: '%H:%M:%S'
                },
            },
            yAxis: {
                title: {
                    text: null
                }
            },
            tooltip: {
                formatter: function() {
                    return '<b>' + this.series.name + '</b><br/>' +
                        Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
                        Highcharts.numberFormat(this.y, 2);
                }
            },
            credits: {
                enabled: false //右下角不显示highcharts的logo
            },
            series: series,
        });

        //把该截面所有的通道显示在highchart上
        for (let i in channelData) {
            let channelNum = channelData[i]["channel"];
            let radio = $("<input type='radio' id='" + i + "' name='" + eng_name + "Radio' value='" + channelNum + "'/><label for='" + eng_name + "Radio'>" + channelNum + "   </label>");
            if (i == 0)
                radio = $("<input type='radio' id='" + i + "' name='" + eng_name + "Radio' value='" + channelNum + "' checked='true'/><label for='" + eng_name + "Radio'>" + channelNum + "    </label>");
            $("#" + eng_name + "Radios").append(radio);
        }

        //为单选按钮添加change事件，当通道号发生改变，图表要相应改变
        $('input[type=radio][name=' + eng_name + 'Radio]').change(function() {
            let index = $("input[name='" + eng_name + "Radio']:checked").attr("id");
            //更新当前通道值和ip
            currChannel = channelData[index]["channel"];
            currIp = channelData[index]["ip"];
            //更新标题
            chart.setTitle({
                text: name + '-通道' + currChannel + '-实时数据'
            });
            let series = prepareSeriesData(currChannel, currIp);
            //console.log(series);
            //更新线的值
            chart.update({
                series: series
            });
        });
    }
    //$("#southshackWestChart").show();

    //配置webSocket图表的图片，添加鼠标悬浮、离开事件
    function webSocketConfig() {
        //jquery是添加行內
        $("#webSocket").css("background-image", "url(../static/images/socket_off.png)");
        //添加鼠标悬浮事件
        $("#webSocket").hover(function(evt) {
            var xPos = $(window).width() - 220; //(evt.pageX || evt.clientX || evt.offsetX || evt.x) - 50;
            var yPos = $(window).height() - 80;

            $("#label").css({
                left: xPos,
                top: yPos,
                display: 'block'
            });
            if ($(this).css("background-image").indexOf("off") != -1)
                $("#label").html("socket未连接");
            else if ($(this).css("background-image").indexOf("error") != -1)
                $("#label").html("socket连接异常");
            else
                $("#label").html("socket已连接");
        });

        //添加鼠标离开事件
        $("#webSocket").mouseleave(function(evt) {
            $("#label").css({
                display: 'none'
            });
        });
    }

    //连接webSocket，并且设置onopen、onmessage、onclose、onerror事件
    function webSocketEvent() {
        var url = "ws://192.168.8.35";
        var ws = new WebSocket(url); //申请一个WebSocket对象，参数是服务端地址，同http协议使用http://开头一样，WebSocket协议的url使用ws://开头，另外安全的WebSocket协议使用wss://开头
        ws.onopen = function() {　　 //当WebSocket创建成功时，触发onopen事件
            console.log("socket connected");　　
            $("#webSocket").css("background-image", "url(../static/images/socket_on.png)");
        }
        ws.onmessage = function(e) {　　 //当客户端收到服务端发来的消息时，触发onmessage事件，参数e.data包含server传递过来的数据　　
            //console.log(e.data);　
            //处理数据，并存下来
            var strs = e.data.split('|');
            socketData = [];
            for (let i = 2, t = 1, index = 0; i < strs.length;) {
                let Ddata = parseFloat(strs[i]); //
                if (Ddata > 0.0) { //说明该通道下有数据
                    i++;
                    let TNum = 'T' + t++;
                    socketData.push({
                        "name": TNum,
                        "data": [],
                    });
                    while (Ddata > 0) {
                        socketData[index]["data"].push(eval(strs[i]));
                        i++;
                        Ddata--;
                    }
                    index++;
                } else
                    i++;
            }
            //console.log(socketData);
        }
        ws.onclose = function(e) {　　 //当客户端收到服务端发送的关闭连接请求时，触发onclose事件　　
            console.log("socket close");
            $("#webSocket").css("background-image", "url(../static/images/socket_off.png)");
            reconnect();
        }
        ws.onerror = function(e) {　　 //如果出现连接、处理、接收、发送数据失败的时候触发onerror事件　
            console.log("socket error");
            $("#webSocket").css("background-image", "url(../static/images/socket_error.png)");
            reconnect();
        }
    }

    //若websocket断开或出错，尝试重新连接
    function reconnect() {
        if (lockReconnect) return;
        lockReconnect = true;
        //没连接上会一直重连，设置延迟避免请求过多
        setTimeout(function() {
            webSocketEvent();
            lockReconnect = false;
        }, 2000);
    }

    function dateFormat(fmt, date) {
        let ret;
        const opt = {
            "Y+": date.getFullYear().toString(), // 年
            "m+": (date.getMonth() + 1).toString(), // 月
            "d+": date.getDate().toString(), // 日
            "H+": date.getHours().toString(), // 时
            "M+": date.getMinutes().toString(), // 分
            "S+": date.getSeconds().toString() // 秒
                // 有其他格式化字符需求可以继续添加，必须转化成字符串
        };
        for (let k in opt) {
            ret = new RegExp("(" + k + ")").exec(fmt);
            if (ret) {
                fmt = fmt.replace(ret[1], (ret[1].length == 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")))
            };
        };
        return fmt;
    }

    //准备series的数据
    function prepareSeriesData(currChannel, currIp) {
        //去ip和channel下查所有传感器前10s的历史数据
        TableCols = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11",
            "D12", "D13", "D14", "D15", "D16"
        ];
        let lastDate = new Date();
        let firstDate = new Date(lastDate.getTime() - 10 * 1000);
        lastDate = dateFormat("YYYY-mm-dd HH:MM:SS", lastDate);
        firstDate = dateFormat("YYYY-mm-dd HH:MM:SS", firstDate);
        URL = "/ZcmDB|" + currIp + "|select * from T" + currChannel + " where  D0 BETWEEN " + firstDate + " AND " + lastDate + " order by D0;|";
        let historyData = window.selectDB(URL, TableCols);
        historyData = historyData.slice(-10);
        //console.log(historyData);
        //console.log(URL);

        //将数据放入数组中，它为hightchart的初始数据
        var series = [];
        //初始化series数据
        for (let i = 0; i < TableCols.length; i++) {
            series.push({
                "name": TableCols[i],
                "data": [],
                "visible": false
            });
        }
        //将数据填入series中
        for (let i = 0, k = 0; i < 10; i++, k++) {
            let currDate = new Date(firstDate).getTime() + i * 1000;
            if (currDate == historyData[k]) {
                for (let j = 0; j < TableCols.length; j++) {
                    series[j]["data"].push([currDate, parseFloat(historyData[j])]);
                }
            } else {
                for (let j = 0; j < TableCols.length; j++) {
                    series[j]["data"].push([currDate, 0.0]);
                }
            }
        }
        //console.log(series);
        //如果前10s的数据都为0，默认这条线不显示
        for (let i in series) {
            let arr = series[i]["data"];
            let flag = false;
            for (let j in arr)
                if (arr[j][1] != 0) {
                    flag = true;
                    break;
                }
            series[i]["visible"] = flag;
        }

        return series;
    }

    //让highChartDiv可被鼠标拖拽
    //console.log($(".chartTitle"));
    // $(".chartTitle").each(function() {
    //     var flag = false,
    //         vHeight, vWidth, cHeight, cWdith;
    //     $(this).click(function() {
    //         alert('s')
    //     });
    //     target.mousedown(function(e) {
    //         flag = true;
    //         vHeight = e.pageY;
    //         vWidth = e.pageX;
    //         cHeight = vHeight - $(this).offset().top;
    //         cWdith = vWidth - $(this).offset().left;
    //         //alert("divshow" + $(this).offset().top + " divvHeight" + vHeight);
    //         //alert("高" + cHeight + " 宽" + cWdith);
    //     })

    //     var showWidth = highChartDiv.width();
    //     var showHeight = highChartDiv.height();
    //     var documentWidth = $(document).width();
    //     var documentHeight = $(document).height();

    //     target.mousemove(function(e) {
    //         if (flag) {
    //             var divheight = e.pageY - cHeight; //窗口要移动到的位置
    //             var divwidth = e.pageX - cWdith; //窗口要移动到的位置
    //             //$("#la1").text(divheight + "w" + divwidth + "win" + showWidth + " x " + documentWidth + "" + showWidth);
    //             if (divwidth < 0) {
    //                 divwidth = 0;
    //             }
    //             if (divheight < 50) {
    //                 divheight = 50;
    //             }
    //             if (divwidth > documentWidth - showWidth) {
    //                 divwidth = documentWidth - showWidth - 5;
    //             }
    //             if (divheight > documentHeight - showHeight) {
    //                 divheight = documentHeight - showHeight - 5;
    //             }
    //             highChartDiv.css({
    //                 "left": divwidth,
    //                 "top": divheight
    //             });
    //         }
    //     });

    //     target.mouseup(function() {
    //         flag = false;
    //     });
    // });


    function activeLastPointToolip(chart) {
        var points = chart.series[0].points;
        chart.tooltip.refresh(points[points.length - 1]);
    }
    var chart = Highcharts.chart('湖工大Chart', {
        chart: {
            type: 'spline',
            marginRight: 10,
            events: {
                load: function() {
                    var series = this.series[0],
                        chart = this;
                    activeLastPointToolip(chart);
                    setInterval(function() {
                        var x = (new Date()).getTime(), // 当前时间
                            y = Math.random(); // 随机值
                        series.addPoint([x, y], true, true);
                        activeLastPointToolip(chart);
                    }, 1000);
                }
            }
        },
        title: {
            text: '湖工大'
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
        },
        yAxis: {
            title: {
                text: null
            }
        },
        tooltip: {
            formatter: function() {
                return '<b>' + this.series.name + '</b><br/>' +
                    Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
                    Highcharts.numberFormat(this.y, 2);
            }
        },
        legend: {
            enabled: false
        },
        series: [{
            name: '',
            data: (function() {
                // 生成随机值
                var data = [],
                    time = (new Date()).getTime(),
                    i;
                for (i = -19; i <= 0; i += 1) {
                    data.push({
                        x: time + i * 1000,
                        y: Math.random()
                    });
                }
                return data;
            }())
        }]
    });
    var chart2 = Highcharts.chart('板桥Chart', {
        chart: {
            type: 'spline',
            marginRight: 10,
            events: {
                load: function() {
                    var series = this.series[0],
                        chart = this;
                    activeLastPointToolip(chart);
                    setInterval(function() {
                        var x = (new Date()).getTime(), // 当前时间
                            y = Math.random(); // 随机值
                        series.addPoint([x, y], true, true);
                        activeLastPointToolip(chart);
                    }, 1000);
                }
            }
        },
        title: {
            text: '板桥'
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
        },
        yAxis: {
            title: {
                text: null
            }
        },
        tooltip: {
            formatter: function() {
                return '<b>' + this.series.name + '</b><br/>' +
                    Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
                    Highcharts.numberFormat(this.y, 2);
            }
        },
        legend: {
            enabled: false
        },
        series: [{
            name: '',
            data: (function() {
                // 生成随机值
                var data = [],
                    time = (new Date()).getTime(),
                    i;
                for (i = -19; i <= 0; i += 1) {
                    data.push({
                        x: time + i * 1000,
                        y: Math.random()
                    });
                }
                return data;
            }())
        }]
    });
    var chart3 = Highcharts.chart('野芷湖Chart', {
        chart: {
            type: 'spline',
            marginRight: 10,
            events: {
                load: function() {
                    var series = this.series[0],
                        chart = this;
                    activeLastPointToolip(chart);
                    setInterval(function() {
                        var x = (new Date()).getTime(), // 当前时间
                            y = Math.random(); // 随机值
                        series.addPoint([x, y], true, true);
                        activeLastPointToolip(chart);
                    }, 1000);
                }
            }
        },
        title: {
            text: '野芷湖'
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
        },
        yAxis: {
            title: {
                text: null
            }
        },
        tooltip: {
            formatter: function() {
                return '<b>' + this.series.name + '</b><br/>' +
                    Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
                    Highcharts.numberFormat(this.y, 2);
            }
        },
        legend: {
            enabled: false
        },
        series: [{
            name: '',
            data: (function() {
                // 生成随机值
                var data = [],
                    time = (new Date()).getTime(),
                    i;
                for (i = -19; i <= 0; i += 1) {
                    data.push({
                        x: time + i * 1000,
                        y: Math.random()
                    });
                }
                return data;
            }())
        }]
    });

});