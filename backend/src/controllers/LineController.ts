import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Line, LineStatus } from '../models/Line';

export class LineController {
  private lineRepository = AppDataSource.getRepository(Line);

  // Get all lines
  public getAllLines = async (req: Request, res: Response): Promise<void> => {
    try {
      const lines = await this.lineRepository.find({
        relations: ['workOrders']
      });
      res.json(lines);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch lines', error });
    }
  };

  // Get line by ID
  public getLineById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const line = await this.lineRepository.findOne({
        where: { id },
        relations: ['workOrders']
      });

      if (!line) {
        res.status(404).json({ message: 'Line not found' });
        return;
      }

      res.json(line);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch line', error });
    }
  };

  // Create new line
  public createLine = async (req: Request, res: Response): Promise<void> => {
    try {
      const line = this.lineRepository.create(req.body);
      const savedLine = await this.lineRepository.save(line);
      res.status(201).json(savedLine);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create line', error });
    }
  };

  // Update line
  public updateLine = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const line = await this.lineRepository.findOne({
        where: { id }
      });

      if (!line) {
        res.status(404).json({ message: 'Line not found' });
        return;
      }

      this.lineRepository.merge(line, req.body);
      const updatedLine = await this.lineRepository.save(line);
      res.json(updatedLine);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update line', error });
    }
  };

  // Delete line
  public deleteLine = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.lineRepository.delete(id);

      if (result.affected === 0) {
        res.status(404).json({ message: 'Line not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete line', error });
    }
  };

  // Update line status
  public updateLineStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!Object.values(LineStatus).includes(status)) {
        res.status(400).json({ message: 'Invalid line status' });
        return;
      }

      const line = await this.lineRepository.findOne({
        where: { id }
      });

      if (!line) {
        res.status(404).json({ message: 'Line not found' });
        return;
      }

      line.status = status;
      const updatedLine = await this.lineRepository.save(line);
      res.json(updatedLine);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update line status', error });
    }
  };

  // Get line utilization
  public getLineUtilization = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ message: 'Start date and end date are required' });
        return;
      }

      const line = await this.lineRepository.findOne({
        where: { id },
        relations: ['workOrders']
      });

      if (!line) {
        res.status(404).json({ message: 'Line not found' });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      // Filter work orders within date range
      const relevantWorkOrders = line.workOrders?.filter(wo => 
        wo.startDate && wo.startDate >= start && wo.startDate <= end
      ) || [];

      // Calculate total job time in hours
      const totalJobTime = relevantWorkOrders.reduce((acc, wo) => 
        acc + (wo.totalJobTime / 60), 0);

      const utilization = (totalJobTime / totalHours) * 100;

      res.json({
        lineId: id,
        startDate,
        endDate,
        totalWorkOrders: relevantWorkOrders.length,
        totalJobTimeHours: totalJobTime,
        utilizationPercentage: Math.round(utilization * 100) / 100
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to calculate line utilization', error });
    }
  };
} 