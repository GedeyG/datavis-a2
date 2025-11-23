// Waiting until document has loaded
window.onload = () => {

  // Set dimensions and margins for the SCATTERPLOT
  var margin = {top: 20, right: 30, bottom: 60, left: 60},
      width = 600 - margin.left - margin.right, 
      height = 500 - margin.top - margin.bottom;

  // Append the SVG object to the container
  var svg = d3.select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // ----------------------------------------------------------------
  // Data Cleaning Function
  // ----------------------------------------------------------------
  function rowConverter(d) {
      return {
          Name: d.Name,
          Type: d.Type,
          HorsepowerHP: +d["Horsepower(HP)"],
          CityMPG: +d["City Miles Per Gallon"],
          RetailPrice: +d["Retail Price"],
          EngineSizeL: +d["Engine Size (l)"],
          Cyl: +d.Cyl,
          HighwayMPG: +d["Highway Miles Per Gallon"]
      };
  }

  // ----------------------------------------------------------------
  // Load Data
  // ----------------------------------------------------------------
  d3.csv("cars.csv", rowConverter).then(function(data) {
        
        // --- Data Filtering ---
        var cleanData = data.filter(d => 
            !isNaN(d.HorsepowerHP) && d.HorsepowerHP > 0 &&
            !isNaN(d.CityMPG) && d.CityMPG > 0 &&
            !isNaN(d.RetailPrice) && d.RetailPrice > 0 &&
            d.EngineSizeL > 0 &&
            d.Cyl > 0 &&
            d.CityMPG < 90 && 
            d.HighwayMPG > 0
        );

        if (cleanData.length === 0) return;

        // ----------------------------------------------------------------
        // SCATTERPLOT SETUP
        // ----------------------------------------------------------------
        
        // Scales - NOW STARTING AT 0
        var x = d3.scaleLinear()
            .domain([0, d3.max(cleanData, d => d.HorsepowerHP)]) 
            .range([ 0, width ]);
        
        var y = d3.scaleLinear()
            .domain([0, d3.max(cleanData, d => d.CityMPG)])
            .range([ height, 0]);
        
        var uniqueTypes = [...new Set(cleanData.map(d => d.Type))].sort();
        var color = d3.scaleOrdinal()
            .domain(uniqueTypes)
            .range(d3.schemeCategory10); 

        var size = d3.scaleLinear()
            .domain(d3.extent(cleanData, d => d.RetailPrice))
            .range([3, 12]);

        // Draw Axes
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x));
        svg.append("text")
            .attr("class", "x-axis-label")
            .attr("x", width / 2)
            .attr("y", height + 40) 
            .style("text-anchor", "middle")
            .text("Horsepower (HP)");

        svg.append("g").call(d3.axisLeft(y));
        svg.append("text")
            .attr("class", "y-axis-label")
            .attr("transform", "rotate(-90)")
            .attr("y", -40) 
            .attr("x", -height / 2) 
            .style("text-anchor", "middle")
            .text("City Miles Per Gallon (MPG)");

        // ----------------------------------------------------------------
        // DRAW DOTS & INTERACTION
        // ----------------------------------------------------------------
        var dots = svg.append('g')
            .selectAll("circle")
            .data(cleanData)
            .enter()
            .append("circle")
            .attr("cx", function (d) { return x(d.HorsepowerHP); } )
            .attr("cy", function (d) { return y(d.CityMPG); } )
            .attr("r", function (d) { return size(d.RetailPrice); } ) 
            .style("fill", function (d) { return color(d.Type); } )   
            .style("opacity", 0.6)
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            // === INTERACTIVITY START ===
            .on("click", function(d) {
                // 1. Highlight the dot
                d3.selectAll("circle").classed("selected-dot", false); // Deselect all
                d3.select(this).classed("selected-dot", true); // Select clicked
                
                // 2. Update Info Panel
                updateDetails(d);
                
                // 3. Draw Star Plot
                drawStarPlot(d);
            });
        
        // Add Legend
        var legend = svg.selectAll(".legend")
            .data(uniqueTypes)
            .enter().append("g")
            .attr("transform", function(d, i) { return "translate(" + (width - 100) + "," + i * 20 + ")"; });
        legend.append("rect").attr("width", 12).attr("height", 12).style("fill", color);
        legend.append("text").attr("x", 18).attr("y", 6).attr("dy", ".35em").text(d => d);


        // ----------------------------------------------------------------
        // HELPER: Update Details Panel
        // ----------------------------------------------------------------
        function updateDetails(d) {
            var infoHtml = `
                <h3>${d.Name}</h3>
                <p><strong>Type:</strong> ${d.Type}</p>
                <p><strong>Price:</strong> $${d.RetailPrice}</p>
                <ul>
                    <li>HP: ${d.HorsepowerHP}</li>
                    <li>City MPG: ${d.CityMPG}</li>
                    <li>Highway MPG: ${d.HighwayMPG}</li>
                    <li>Engine: ${d.EngineSizeL} L</li>
                    <li>Cylinders: ${d.Cyl}</li>
                </ul>
            `;
            d3.select("#info_text").html(infoHtml);
            d3.select(".hint").style("display", "none");
        }

        // ----------------------------------------------------------------
        // HELPER: Draw Star Plot
        // ----------------------------------------------------------------
        // Pre-calculate scales for the 6 attributes based on the WHOLE dataset
        // This ensures the star plot shape is relative to the min/max of all cars
        var features = ["HorsepowerHP", "CityMPG", "HighwayMPG", "RetailPrice", "EngineSizeL", "Cyl"];
        var featureScales = {};
        
        features.forEach(f => {
            featureScales[f] = d3.scaleLinear()
                .domain([0, d3.max(cleanData, d => d[f])]) // Start from 0 for area chart context
                .range([0, 100]); // Map to radius 0-100px
        });

        function drawStarPlot(d) {
            // Clear previous star plot
            d3.select("#star_plot_area").html("");

            var starWidth = 300;
            var starHeight = 300;
            var radius = 100;
            var center = {x: starWidth / 2, y: starHeight / 2};

            var starSvg = d3.select("#star_plot_area")
                .append("svg")
                .attr("width", starWidth)
                .attr("height", starHeight);
            
            // Calculate coordinates for the selected car
            var lineData = [];
            var angleSlice = Math.PI * 2 / features.length;

            features.forEach((f, i) => {
                var angle = i * angleSlice - Math.PI / 2; // Start at 12 o'clock
                var r = featureScales[f](d[f]);
                
                var x = center.x + Math.cos(angle) * r;
                var y = center.y + Math.sin(angle) * r;
                
                lineData.push({x: x, y: y});

                // Draw Axis Line
                var axisX = center.x + Math.cos(angle) * radius;
                var axisY = center.y + Math.sin(angle) * radius;
                
                starSvg.append("line")
                    .attr("x1", center.x)
                    .attr("y1", center.y)
                    .attr("x2", axisX)
                    .attr("y2", axisY)
                    .attr("class", "star-axis");
                
                // Draw Label
                var labelX = center.x + Math.cos(angle) * (radius + 15);
                var labelY = center.y + Math.sin(angle) * (radius + 15);
                starSvg.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .text(f)
                    .attr("class", "star-label");
            });

            // Close the shape
            lineData.push(lineData[0]);

            // Draw the Star Shape
            var lineGenerator = d3.line()
                .x(d => d.x)
                .y(d => d.y);

            starSvg.append("path")
                .datum(lineData)
                .attr("d", lineGenerator)
                .attr("class", "star-path")
                .style("fill", "rgba(31, 119, 180, 0.4)")
                .style("stroke", "#1f77b4");
        }

    })
    .catch(function(error) {
        console.error(error);
    });
};
