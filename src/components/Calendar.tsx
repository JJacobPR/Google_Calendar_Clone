import { FormEvent, useId, useMemo, useRef, useState } from "react";
import { startOfWeek, startOfMonth, endOfWeek, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, endOfDay, isToday, subMonths, addMonths, isSameDay, parse } from "date-fns";
import "./Calendar.css";
import { formatDate } from "../utils/formatDate";
import { cc } from "../utils/cc";
import { EVENT_COLORS, useEvents } from "../context/useEvent";
import Modal, { ModalProps } from "./Modal";
import { UnionOmit } from "../utils/types";
import { Event } from "../context/Events";

const Calendar = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { events } = useEvents();

  const calendarDays = useMemo(() => {
    const firstWeekStart = startOfWeek(startOfMonth(selectedMonth));
    const lastWeekEnd = endOfWeek(endOfMonth(selectedMonth));
    return eachDayOfInterval({ start: firstWeekStart, end: lastWeekEnd });
  }, [selectedMonth]);

  return (
    <div className="calendar">
      <div className="header">
        <button className="btn" onClick={() => setSelectedMonth(new Date())}>
          Today
        </button>
        <div>
          <button
            onClick={() => {
              setSelectedMonth((m) => subMonths(m, 1));
            }}
            className="month-change-btn"
          >
            &lt;
          </button>
          <button
            onClick={() => {
              setSelectedMonth((m) => addMonths(m, 1));
            }}
            className="month-change-btn"
          >
            &gt;
          </button>
        </div>
        <span className="month-title">{formatDate(selectedMonth, { month: "long", year: "numeric" })}</span>
      </div>
      <div className="days">
        {calendarDays.map((day, index) => (
          <CalendarDay key={day.getTime()} day={day} showWeekName={index < 7} events={events.filter((event) => isSameDay(day, event.date))} selectedMonth={selectedMonth} />
        ))}
      </div>
    </div>
  );
};

type CalendarDayProps = {
  day: Date;
  showWeekName: boolean;
  selectedMonth: Date;
  events: Event[];
};

const CalendarDay = ({ day, showWeekName, selectedMonth, events }: CalendarDayProps) => {
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const { addEvent } = useEvents();

  const sortedEvents = useMemo(() => {
    const timeToNumber = (time: string) => parseFloat(time.replace(":", ""));

    return [...events].sort((a, b) => {
      if (a.allDay && b.allDay) return 0;
      else if (a.allDay) return -1;
      else if (b.allDay) return 1;
      else {
        return timeToNumber(a.startTime) - timeToNumber(b.startTime);
      }
    });
  }, [events]);

  return (
    <div className={cc("day", isSameMonth(day, selectedMonth) && "non-month-day", isBefore(endOfDay(day), new Date()) && "old-month-day")}>
      <div className="day-header">
        {showWeekName && <div className="week-name">{formatDate(day, { weekday: "short" })}</div>}
        <div className={cc("day-number", isToday(day) && "today")}>{formatDate(day, { day: "numeric" })}</div>
        <button
          className="add-event-btn"
          onClick={() => {
            setIsNewEventModalOpen(true);
          }}
        >
          +
        </button>
      </div>
      {events.length > 0 && (
        <div className="events">
          {sortedEvents.map((event) => (
            <CalendarEvent key={event.id} event={event} />
          ))}
        </div>
      )}
      <EventFormModal date={day} isOpen={isNewEventModalOpen} onClose={() => setIsNewEventModalOpen(false)} onSubmit={addEvent} />
    </div>
  );
};

const CalendarEvent = ({ event }: { event: Event }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { updateEvent, deleteEvent } = useEvents();

  let startDate: Date = new Date();

  if (event.startTime !== undefined) {
    const [hours, minutes] = event.startTime.split(":");
    startDate = new Date(event.date);
    startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }

  return (
    <>
      <button onClick={() => setIsEditModalOpen(true)} className={cc("event", event.color, event.allDay && "all-day-event")}>
        {event.allDay ? (
          <div className="event-name">{event.name}</div>
        ) : (
          <>
            <div className={`color-dot ${event.color}`}></div>
            <div className="event-time">{event.startTime && formatDate(startDate, { timeStyle: "short" })}</div>
            <div className="event-name">{event.name}</div>
          </>
        )}
      </button>
      <EventFormModal event={event} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={(e) => updateEvent(event.id, e)} onDelete={() => deleteEvent(event.id)} />
    </>
  );
};

type EventFormModalProps = {
  onSubmit: (event: UnionOmit<Event, "id">) => void;
} & ({ onDelete: () => void; event: Event; date?: never } | { onDelete?: () => never; event?: never; date: Date }) &
  Omit<ModalProps, "children">;

const EventFormModal = ({ onSubmit, onDelete, event, date, ...modalProps }: EventFormModalProps) => {
  const isNew = event == null;
  const formID = useId();
  const [selectedColor, setSelectedColor] = useState(event?.color || EVENT_COLORS[0]);
  const [isAllDayChecked, setIsAllDayChecked] = useState(event?.allDay || false);
  const [startTime, setStartTime] = useState(event?.startTime || "");
  const endTimeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = nameRef.current?.value;
    const endTime = endTimeRef.current?.value;

    if (name === null || name === "" || name === undefined) return;

    const commonProps = {
      name,
      date: date || event?.date,
      color: selectedColor,
    };

    let newEvent: UnionOmit<Event, "id">;

    if (isAllDayChecked) {
      newEvent = {
        ...commonProps,
        allDay: true,
      };
    } else {
      if (startTime === null || startTime === "" || endTime === null || endTime === "" || endTime === undefined) return;
      newEvent = {
        ...commonProps,
        allDay: false,
        startTime,
        endTime,
      };
    }

    modalProps.onClose();
    onSubmit(newEvent);
  };

  return (
    <Modal {...modalProps}>
      <div className="modal-title">
        <div>{isNew ? "Add" : "Edit"} Event</div>
        <small>{formatDate(date || event.date, { dateStyle: "short" })}</small>
        <button onClick={modalProps.onClose} className="close-btn">
          &times;
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor={`${formID}-name`}>Name</label>
          <input defaultValue={event?.name} ref={nameRef} type="text" name="name" id={`${formID}-name`} />
        </div>
        <div className="form-group checkbox">
          <input checked={isAllDayChecked} onChange={(event) => setIsAllDayChecked(event.target.checked)} type="checkbox" name="all-day" id={`${formID}-all-day`} />
          <label htmlFor={`${formID}-all-day`}>All Day?</label>
        </div>
        <div className="row">
          <div className="form-group">
            <label htmlFor={`${formID}-start-time`}>Start Time</label>
            <input type="time" name="start-time" id={`${formID}-start-time`} value={startTime} onChange={(event) => setStartTime(event.target.value)} disabled={isAllDayChecked} required={!isAllDayChecked} />
          </div>
          <div className="form-group">
            <label htmlFor={`${formID}-end-time`}>End Time</label>
            <input type="time" name="end-time" id={`${formID}-end-time`} defaultValue={event?.endTime} ref={endTimeRef} disabled={isAllDayChecked} required={!isAllDayChecked} />
          </div>
        </div>
        <div className="form-group">
          <label>Color</label>
          <div className="row left">
            {EVENT_COLORS.map((color) => (
              <>
                <input
                  type="radio"
                  name="color"
                  value={color}
                  id={`${formID}-${color}`}
                  checked={selectedColor === color}
                  onChange={() => {
                    setSelectedColor(color);
                  }}
                  className="color-radio"
                />
                <label htmlFor={`${formID}-${color}`}>
                  <span className="sr-only">{color}</span>
                </label>
              </>
            ))}
          </div>
        </div>
        <div className="row">
          <button className="btn btn-success" type="submit">
            {isNew ? "Add" : "Edit"}
          </button>
          {onDelete != null && (
            <button onClick={onDelete} className="btn btn-delete" type="button">
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default Calendar;
