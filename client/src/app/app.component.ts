import { Component, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import * as _ from 'lodash';
import * as ol from 'openlayers';
import { Router, NavigationEnd, ActivatedRoute, UrlSegmentGroup } from '@angular/router';
import { AuthenticationService } from './services/authentication.service';
import { EventService } from './services/event.service';
import { EventClass } from './domain/event.class';
import { ContributorClass } from './domain/contributor.class';
import { zip } from 'rxjs';
import { ContributorService } from './services/contributor.service';
import { filter } from 'rxjs/operators';
import { ArrayUtils } from './util/ArrayUtils';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  eventColor = '#6CCACC';
  contributorColor = '#F9A755';
  selectedEventColor = '#FF5555';

  events: EventClass[];
  contributors: ContributorClass[];

  @ViewChild('map') mapElement: ElementRef;
  title = 'client';
  initialCoordinates: [number, number] = [538262.3872128094, 5740786.2887582248];
  initialZoom: number = 11;
  searchZoom: number = 16;
  map: ol.Map;

  public showSidenav: boolean = false;
  eventsFeatures: ol.Feature[];
  contributorsFeatures: ol.Feature[];
  eventsMarkerSource: ol.source.Vector;
  contributorsMarkerSource: ol.source.Vector;
  eventsLayer: ol.layer.Vector;
  contributorsLayer: ol.layer.Vector;
  selectInteraction: ol.interaction.Select;
  currentRouteWithNoSelection: ActivatedRoute;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private eventService: EventService,
    private contributorService: ContributorService,
    private authenticationService: AuthenticationService
  ) { }

  ngOnInit() {
  }

  get eventStyle() {
    return new ol.style.Style({
      image: new ol.style.Icon(/** @type {olx.style.IconOptions} */({
        color: this.eventColor,
        src: 'assets/pin.png',
        anchor: [0.5, 1]
      }))
    });
  }

  get contributorStyle() {
    return new ol.style.Style({
      image: new ol.style.Icon(/** @type {olx.style.IconOptions} */({
        color: this.contributorColor,
        src: 'assets/pin.png',
        anchor: [0.5, 1]
      }))
    });
  }

  get selectedEventStyle() {
    return new ol.style.Style({
      image: new ol.style.Icon(/** @type {olx.style.IconOptions} */({
        color: this.selectedEventColor,
        src: 'assets/pin.png',
        anchor: [0.5, 1]
      }))
    });
  }

  get routingUrls() {
    const admin = 'admin';
    const events = 'events';
    const contributors = 'contributors';
    const root = '';

    const routes = {
      events: this.authenticationService.isConnected ? [admin, events] : [events],
      contributors: this.authenticationService.isConnected ? [admin, contributors] : [events],
      root: this.authenticationService.isConnected ? [admin, root] : [events]
    }
    return routes;
  }

  /**
   * Center the map on the given coordinates
   * @param coordinates coordinates
   */
  goTo(coordinates: [number, number]) {
    this.map.set('view', new ol.View({
      center: ol.proj.fromLonLat(coordinates, 'EPSG:3857'),
      zoom: this.searchZoom
    }));
  }

  ngAfterViewInit(): void {
    this.initializeData().subscribe(pair => {
      this.events = pair[0];
      this.contributors = pair[1];
      this.initializeMap();

      //Select the right marker when URL is "/events/:id" or "/contributors/:id"
      const currentUrl = this.router.parseUrl(this.router.url).root.children.primary
      this.selectCurrentMarker(currentUrl);
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(res => {
        const currentUrl = this.router.parseUrl((<NavigationEnd>res).urlAfterRedirects).root.children.primary;
        this.selectCurrentMarker(currentUrl);
        console.log(this.activatedRoute);
      });
    });
  }

  selectCurrentMarker(currentUrl: UrlSegmentGroup) {
    this.selectInteraction.getFeatures().clear();

    let pathToCompare;
    let next;
    if (this.authenticationService.isConnected) {
      pathToCompare = currentUrl.segments.slice(0, 1);
      next = currentUrl.segments[2];
    }
    else {
      pathToCompare = currentUrl.segments.slice(0, 0);
      next = currentUrl.segments[1];
    }

    if (ArrayUtils.compareSortedArrays(pathToCompare, this.routingUrls.events) && !isNaN(+next)) {
      this.selectInteraction.getFeatures().push(this.eventsFeatures.find(x => x.get('id') === +currentUrl.segments[1].path));
    }
    else if (ArrayUtils.compareSortedArrays(pathToCompare, this.routingUrls.contributors) && !isNaN(+next)) {
      this.selectInteraction.getFeatures().push(this.contributorsFeatures.find(x => x.get('id') === +currentUrl.segments[1].path));
    }
  }

  initializeData() {
    return zip(this.eventService.getAll(),
      this.authenticationService.isConnected ? this.contributorService.getAll() : this.contributorService.getAssistants());
  }

  initializeMap() {
    this.eventsFeatures = this.events.map((event) =>
      new ol.Feature({
        geometry: new ol.geom.Point([event.longitude, event.latitude]),
        type: 'event',
        id: event.id
      })
    );

    this.eventsMarkerSource = new ol.source.Vector({
      features: this.eventsFeatures
    });

    this.contributorsFeatures = this.contributors.map((contributor) =>
      new ol.Feature({
        geometry: new ol.geom.Point([contributor.longitude, contributor.latitude]),
        type: 'contributor',
        id: contributor.id
      })
    );

    this.contributorsMarkerSource = new ol.source.Vector({
      features: this.contributorsFeatures
    });

    this.eventsLayer = new ol.layer.Vector({
      source: this.eventsMarkerSource,
      style: this.eventStyle,
    });

    this.contributorsLayer = new ol.layer.Vector({
      source: this.contributorsMarkerSource,
      style: this.contributorStyle,
    });

    this.selectInteraction = new ol.interaction.Select(
      {
        multi: false,
        style: this.selectedEventStyle,
        hitTolerance: 10
      }
    );

    this.map = new ol.Map({
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM()
        }),
        this.eventsLayer,
        this.contributorsLayer,
      ],
      target: this.mapElement.nativeElement,
      controls: ol.control.defaults({
        attribution: false,
        zoom: false,
        rotate: false
      }),
      interactions:
        ol.interaction.defaults({ doubleClickZoom: false }).extend([
          this.selectInteraction
        ]),
      view: new ol.View({
        center: this.initialCoordinates,
        zoom: this.initialZoom
      })
    });

    this.selectInteraction.on('select', (e: ol.interaction.Select.Event) => {
      console.log('1');
      if (e.selected && e.target.getFeatures().item(0)) {
        console.log('2');
        if (e.target.getFeatures().item(0).get('type') === 'event') {

          this.router.navigate([...this.routingUrls.events, e.target.getFeatures().item(0).getProperties().id]);
        }
        else if (e.target.getFeatures().item(0).get('type') === 'contributor') {
          console.log('4');
          this.router.navigate([...this.routingUrls.contributors, e.target.getFeatures().item(0).getProperties().id]);
        }
      }
      else {
        console.log('5');
        this.router.navigate(this.routingUrls.root);
      }
    });

    // change mouse cursor when over marker
    this.map.on('pointermove', (e) => {
      var pixel = this.map.getEventPixel(e['originalEvent']);
      var mapDiv = (this.map.getTarget() as Element)

      this.map.hasFeatureAtPixel(pixel) ? mapDiv.classList.add("clickable") : mapDiv.classList.remove("clickable");
    });

    /*var mousePosition = new ol.control.MousePosition({
      coordinateFormat: ol.coordinate.createStringXY(10),
      projection: 'EPSG:3857',
      target: document.getElementById('myposition'),
      undefinedHTML: '&nbsp;'
    });

    this.map.addControl(mousePosition);*/
  }

  onPrimaryRouterActivate(event) {
    this.showSidenav = true;
  }

  onPrimaryRouterDeactivate(event) {
    this.showSidenav = false;
  }

  /**
   * Subscribe to router outlet's child component's event
   * @param elementRef sidenav
   */
  onActivate(elementRef) {
    // Event filter of the sidenav
    elementRef.filterEvents.subscribe(filters => {
      this.eventService.getAll(filters).subscribe(events => {
        this.redrawEvents(events);
      });
    }, err => {
      console.error(err);
    });
    elementRef.filterContributors.subscribe(filters => {
      // TODO
      this.contributorService.getAll(filters).subscribe(contributors => {
        this.redrawContributors(contributors);
      });
    }, err => {
      console.error(err);
    });
  }

  /**
   * Remove all events from layer then add the new ones
   * @param events list of new events to draw
   */
  redrawEvents(events) {
    // Removing all previous features of eventLayer
    _.each(this.eventsLayer.getSource().getFeatures(), feature => {
      this.eventsLayer.getSource().removeFeature(feature);
    });

    // Adding all new features (events) of eventLayer
    events.map((event) =>
      this.eventsLayer.getSource().addFeature(new ol.Feature({
        geometry: new ol.geom.Point([event.longitude, event.latitude]),
        type: 'event',
        id: event.id
      }))
    );
  }

  /**
   * Remove all contributors from layer then add the new ones
   * @param contributors list of new contributors to draw
   */
  redrawContributors(contributors) {
    // Removing all previous features of eventLayer
    _.each(this.contributorsLayer.getSource().getFeatures(), feature => {
      this.contributorsLayer.getSource().removeFeature(feature);
    });

    // Adding all new features (contributors) of eventLayer
    contributors.map((contributor) =>
      this.contributorsLayer.getSource().addFeature(new ol.Feature({
        geometry: new ol.geom.Point([contributor.longitude, contributor.latitude]),
        type: 'contributor',
        id: contributor.id
      }))
    );
  }
}
